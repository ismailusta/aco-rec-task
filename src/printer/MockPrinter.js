import { config } from '../config/env.js';
import {
  ERROR_CODES,
  ERROR_DETAILS,
  pickRandomHardwareError,
} from './errors.js';
import { CONNECTION_STATES } from './ConnectionManager.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const PRINTER_STATES = {
  IDLE: 'idle',
  PRINTING: 'printing',
  ERROR: 'error',
};

export class MockPrinter {
  constructor(connectionManager, logger) {
    this.connection = connectionManager;
    this.logger = logger;
    this.state = PRINTER_STATES.IDLE;
    this.hardware = {
      paper: 'ok',
      cover: 'closed',
      temperature: 'normal',
    };
    this.paperRollPercent = config.paperRollPercent;
    this.lastJob = null;
    this.forcedError = null;
    this.printDurations = [];
  }

  getHardwareSnapshot() {
    return { ...this.hardware };
  }

  getPaperRollPercent() {
    return this.paperRollPercent;
  }

  setForcedError(code) {
    this.forcedError = code;
    this.applyHardwareFromError(code);
    this.state = PRINTER_STATES.ERROR;
  }

  clearForcedError() {
    this.forcedError = null;
    this.hardware = {
      paper: 'ok',
      cover: 'closed',
      temperature: 'normal',
    };
    if (this.state === PRINTER_STATES.ERROR) {
      this.state = PRINTER_STATES.IDLE;
    }
    this.logger.log({
      op: 'error_clear',
      conn: this.connection.mode,
      status: 'ok',
    });
  }

  applyHardwareFromError(code) {
    switch (code) {
      case ERROR_CODES.PAPER_OUT:
        this.hardware.paper = 'out';
        break;
      case ERROR_CODES.COVER_OPEN:
        this.hardware.cover = 'open';
        break;
      case ERROR_CODES.OVERHEAT:
        this.hardware.temperature = 'overheat';
        break;
      default:
        break;
    }
  }

  resetHardwareAfterSuccess() {
    if (this.hardware.cover === 'open') {
      this.hardware.cover = 'closed';
    }
    if (this.hardware.temperature === 'overheat') {
      this.hardware.temperature = 'normal';
    }
  }

  estimateEtaMs(queueLength) {
    const avg =
      this.printDurations.length > 0
        ? this.printDurations.reduce((a, b) => a + b, 0) /
          this.printDurations.length
        : config.printDelayMs;
    return Math.round(avg * queueLength);
  }

  async printJob(job) {
    if (!this.connection.isConnected()) {
      const error = {
        code: ERROR_CODES.COMM_ERROR,
        detail: ERROR_DETAILS[ERROR_CODES.COMM_ERROR],
      };
      throw error;
    }

    if (this.state === PRINTER_STATES.ERROR && this.forcedError) {
      const code = this.forcedError;
      throw {
        code,
        detail: ERROR_DETAILS[code] || code,
      };
    }

    this.state = PRINTER_STATES.PRINTING;
    const started = Date.now();

    try {
      await sleep(config.printDelayMs);

      if (!this.connection.isConnected()) {
        throw {
          code: ERROR_CODES.COMM_ERROR,
          detail: ERROR_DETAILS[ERROR_CODES.COMM_ERROR],
        };
      }

      if (this.forcedError) {
        const code = this.forcedError;
        this.forcedError = null;
        this.applyHardwareFromError(code);
        this.state = PRINTER_STATES.ERROR;
        throw {
          code,
          detail: ERROR_DETAILS[code] || code,
        };
      }

      if (Math.random() < config.errorProbability) {
        const code = pickRandomHardwareError();
        this.applyHardwareFromError(code);
        this.state = PRINTER_STATES.ERROR;
        throw {
          code,
          detail: ERROR_DETAILS[code],
        };
      }

      if (this.hardware.paper === 'out') {
        throw {
          code: ERROR_CODES.PAPER_OUT,
          detail: ERROR_DETAILS[ERROR_CODES.PAPER_OUT],
        };
      }

      this.paperRollPercent = Math.max(0, this.paperRollPercent - 1);
      if (this.paperRollPercent <= 0) {
        this.hardware.paper = 'out';
        throw {
          code: ERROR_CODES.PAPER_OUT,
          detail: ERROR_DETAILS[ERROR_CODES.PAPER_OUT],
        };
      }

      this.resetHardwareAfterSuccess();
      this.state = PRINTER_STATES.IDLE;

      const duration = Date.now() - started;
      this.printDurations.push(duration);
      if (this.printDurations.length > 20) {
        this.printDurations.shift();
      }

      return { duration };
    } catch (error) {
      this.state = PRINTER_STATES.ERROR;
      throw error;
    }
  }

  getSnapshot() {
    return {
      state: this.state,
      hardware: this.getHardwareSnapshot(),
      paperRollPercent: this.paperRollPercent,
      lastJob: this.lastJob,
      simulatedError: this.forcedError,
      connection: this.connection.getSnapshot(),
    };
  }
}
