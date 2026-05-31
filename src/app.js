import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { EventLogger } from './logger/EventLogger.js';
import { ConnectionManager } from './printer/ConnectionManager.js';
import { MockPrinter } from './printer/MockPrinter.js';
import { IdempotencyRegistry } from './queue/idempotency.js';
import { JobQueue } from './queue/JobQueue.js';
import { FailedJobStore } from './store/FailedJobStore.js';
import { createRouter } from './api/routes.js';
import { ERROR_CODES } from './printer/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const startedAt = Date.now();
  const logger = new EventLogger();
  const connection = new ConnectionManager(logger);
  const printer = new MockPrinter(connection, logger);
  const idempotency = new IdempotencyRegistry();
  const failedStore = new FailedJobStore();
  const queue = new JobQueue({
    printer,
    logger,
    idempotency,
    failedStore,
    connection,
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.static(path.join(__dirname, '../public')));
  app.use('/samples', express.static(path.join(__dirname, '../samples')));

  app.get('/config.js', (_req, res) => {
    res.type('application/javascript');
    res.send(
      `window.APP_CONFIG = ${JSON.stringify({
        apiToken: config.apiToken || '',
      })};`,
    );
  });

  const services = {
    connection,
    printer,
    queue,
    logger,
    failedStore,
    startedAt,
  };

  app.use(createRouter(services));

  app.use((req, res) => {
    logger.log({
      op: 'unknown',
      status: 'error',
      error: {
        code: ERROR_CODES.UNKNOWN_COMMAND,
        detail: `${req.method} ${req.path}`,
      },
    });

    res.status(404).json({
      error: {
        code: ERROR_CODES.UNKNOWN_COMMAND,
        detail: 'Route not found',
      },
    });
  });

  return { app, services };
}
