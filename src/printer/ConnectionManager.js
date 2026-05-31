import { config } from '../config/env.js';
import { ERROR_CODES, ERROR_DETAILS } from './errors.js';

export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms) {
  const variance = ms * 0.1;
  return ms + (Math.random() * variance * 2 - variance);
}

export function calculateBackoffDelay(attempt, baseMs, maxMs) {
  return Math.min(baseMs * 2 ** (attempt - 1), maxMs);
}

export class ConnectionManager {
  constructor(logger) {
    this.logger = logger;
    this.mode = null;
    this.state = CONNECTION_STATES.DISCONNECTED;
    this.reconnectAttempt = 0;
    this.lastError = null;
    this.disconnectTimer = null;
    this.reconnectPromise = null;
    this.listeners = new Set();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.getSnapshot());
    }
  }

  getSnapshot() {
    return {
      mode: this.mode,
      status: this.state,
      reconnectAttempt: this.reconnectAttempt,
      lastError: this.lastError,
    };
  }

  async connect(mode) {
    if (mode !== 'usb' && mode !== 'lan') {
      throw new Error('Invalid connection mode');
    }

    this.clearDisconnectTimer();
    this.mode = mode;
    this.state = CONNECTION_STATES.CONNECTING;
    this.reconnectAttempt = 0;
    this.lastError = null;
    this.notify();

    await sleep(config.connectDelayMs);

    this.state = CONNECTION_STATES.CONNECTED;
    this.logger.log({
      op: 'connect',
      conn: mode,
      status: 'ok',
    });
    this.notify();
    this.scheduleRandomDisconnect();
    return this.getSnapshot();
  }

  scheduleRandomDisconnect() {
    this.clearDisconnectTimer();
    if (this.state !== CONNECTION_STATES.CONNECTED) {
      return;
    }

    this.disconnectTimer = setTimeout(() => {
      if (Math.random() < config.disconnectProbability) {
        this.handleDisconnect();
      } else {
        this.scheduleRandomDisconnect();
      }
    }, 5000 + Math.random() * 10000);
  }

  clearDisconnectTimer() {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  handleDisconnect() {
    if (this.state !== CONNECTION_STATES.CONNECTED) {
      return;
    }

    this.state = CONNECTION_STATES.ERROR;
    this.lastError = {
      code: ERROR_CODES.COMM_ERROR,
      detail: ERROR_DETAILS[ERROR_CODES.COMM_ERROR],
    };

    this.logger.log({
      op: 'disconnect',
      conn: this.mode,
      status: 'error',
      error: this.lastError,
    });
    this.notify();
    this.startReconnect();
  }

  startReconnect() {
    if (this.reconnectPromise) {
      return this.reconnectPromise;
    }

    this.reconnectPromise = this.reconnectLoop().finally(() => {
      this.reconnectPromise = null;
    });

    return this.reconnectPromise;
  }

  async reconnectLoop() {
    while (
      this.state === CONNECTION_STATES.ERROR ||
      this.state === CONNECTION_STATES.RECONNECTING
    ) {
      this.state = CONNECTION_STATES.RECONNECTING;
      this.reconnectAttempt += 1;

      const delay = calculateBackoffDelay(
        this.reconnectAttempt,
        config.backoffBaseMs,
        config.backoffMaxMs,
      );

      this.logger.log({
        op: 'reconnect',
        conn: this.mode,
        status: 'error',
        error: {
          code: ERROR_CODES.COMM_ERROR,
          detail: `Reconnect attempt ${this.reconnectAttempt} in ${Math.round(delay)}ms`,
        },
      });
      this.notify();

      await sleep(jitter(delay));

      if (Math.random() < 0.75 || this.reconnectAttempt >= 4) {
        this.state = CONNECTION_STATES.CONNECTED;
        this.lastError = null;
        this.reconnectAttempt = 0;
        this.logger.log({
          op: 'reconnect',
          conn: this.mode,
          status: 'ok',
        });
        this.notify();
        this.scheduleRandomDisconnect();
        return this.getSnapshot();
      }
    }

    return this.getSnapshot();
  }

  isConnected() {
    return this.state === CONNECTION_STATES.CONNECTED;
  }

  isBusyConnecting() {
    return (
      this.state === CONNECTION_STATES.CONNECTING ||
      this.state === CONNECTION_STATES.RECONNECTING
    );
  }

  async waitUntilConnected(timeoutMs = 60000) {
    const started = Date.now();
    while (!this.isConnected()) {
      if (this.state === CONNECTION_STATES.DISCONNECTED && !this.mode) {
        throw new Error('Printer is disconnected');
      }
      if (Date.now() - started > timeoutMs) {
        throw new Error('Connection timeout');
      }
      if (
        this.state === CONNECTION_STATES.ERROR ||
        this.state === CONNECTION_STATES.RECONNECTING
      ) {
        await this.startReconnect();
      }
      await sleep(200);
    }
  }

  forceDisconnect() {
    this.clearDisconnectTimer();
    if (this.mode) {
      this.handleDisconnect();
    }
  }

  shutdown() {
    this.clearDisconnectTimer();
    this.state = CONNECTION_STATES.DISCONNECTED;
    this.notify();
  }
}
