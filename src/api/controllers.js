import { config } from '../config/env.js';
import { getErrorMessage, ERROR_DETAILS } from '../printer/errors.js';

export function createControllers(services) {
  const { connection, printer, queue, logger, failedStore, startedAt } =
    services;

  return {
    async connect(req, res) {
      try {
        const snapshot = await connection.connect(req.body.mode);
        res.json({
          connection: snapshot,
          message: `Connected via ${req.body.mode}`,
        });
      } catch (error) {
        res.status(400).json({
          error: {
            code: 'CONNECT_FAILED',
            detail: error.message,
          },
        });
      }
    },

    printText(req, res) {
      const { job, duplicate } = queue.submitText(req.body);
      res.status(duplicate ? 200 : 202).json({
        job,
        duplicate,
        message: duplicate
          ? 'Existing job returned (idempotent)'
          : 'Text print job queued',
      });
    },

    printImage(req, res) {
      const { job, duplicate } = queue.submitImage(req.body);
      res.status(duplicate ? 200 : 202).json({
        job,
        duplicate,
        message: duplicate
          ? 'Existing job returned (idempotent)'
          : 'Image print job queued',
      });
    },

    async status(req, res) {
      const failedJobs = await failedStore.list();
      const queueSummary = queue.getSummary();
      const printerSnapshot = printer.getSnapshot();
      const connectionSnapshot = connection.getSnapshot();

      let lastError = null;
      if (printerSnapshot.simulatedError) {
        lastError = {
          code: printerSnapshot.simulatedError,
          detail:
            ERROR_DETAILS[printerSnapshot.simulatedError] ||
            printerSnapshot.simulatedError,
        };
      } else if (
        printerSnapshot.lastJob?.status === 'failed' &&
        printerSnapshot.lastJob?.error
      ) {
        lastError = printerSnapshot.lastJob.error;
      } else if (connectionSnapshot.lastError) {
        lastError = connectionSnapshot.lastError;
      }

      res.json({
        connection: connection.getSnapshot(),
        hardware: printerSnapshot.hardware,
        paperRollPercent: printerSnapshot.paperRollPercent,
        printerState: printerSnapshot.state,
        lastJob: printerSnapshot.lastJob,
        lastError,
        lastErrorMessage: lastError
          ? getErrorMessage(lastError.code, config.defaultLang)
          : null,
        queue: {
          pending: queueSummary.pending,
          processing: queueSummary.processing,
          completed: queueSummary.completed,
          failed: queueSummary.failed,
        },
        jobs: queueSummary.jobs,
        failedJobs,
        etaMs: queue.getEtaMs(),
      });
    },

    logs(req, res) {
      const format = req.query.format || 'json';
      const download = req.query.download === '1' || req.query.download === 'true';

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="printer-logs.csv"',
        );
        return res.send(logger.toCsv());
      }

      if (download) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="printer-logs.json"',
        );
      }

      return res.json(logger.getAll());
    },

    async reprint(req, res) {
      const job = await queue.reprint(req.body.jobId);
      if (!job) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            detail: 'Failed job not found for reprint',
          },
        });
      }

      return res.status(202).json({
        job,
        message: 'Reprint job queued',
      });
    },

    health(req, res) {
      const queueSummary = queue.getSummary();
      res.json({
        status: 'ok',
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        connection: connection.getSnapshot(),
        queueSize:
          queueSummary.pending +
          queueSummary.processing,
        paperRollPercent: printer.getPaperRollPercent(),
      });
    },

    simulateError(req, res) {
      printer.setForcedError(req.body.code);
      logger.log({
        op: 'error',
        conn: connection.mode,
        status: 'error',
        error: {
          code: req.body.code,
          detail: `Simulated ${req.body.code}`,
        },
      });

      res.json({
        message: `Simulated error: ${req.body.code}`,
        hardware: printer.getHardwareSnapshot(),
      });
    },

    clearError(req, res) {
      printer.clearForcedError();
      res.json({
        message: 'Printer error cleared',
        hardware: printer.getHardwareSnapshot(),
      });
    },

    async failedPreview(req, res) {
      const base64 = await failedStore.getImageBase64(req.params.jobId);
      if (!base64) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', detail: 'Preview not found' },
        });
      }

      const buffer = Buffer.from(base64, 'base64');
      res.setHeader('Content-Type', 'image/png');
      return res.send(buffer);
    },
  };
}
