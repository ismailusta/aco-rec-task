import { v4 as uuidv4 } from 'uuid';
import { buildTextPayload } from '../services/ReceiptFormatter.js';

export const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export class JobQueue {
  constructor({ printer, logger, idempotency, failedStore, connection }) {
    this.printer = printer;
    this.logger = logger;
    this.idempotency = idempotency;
    this.failedStore = failedStore;
    this.connection = connection;
    this.queue = [];
    this.processing = false;
    this.listeners = new Set();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.getSummary());
    }
  }

  createJob({ jobId, type, payload, reprintOf = null }) {
    const now = new Date().toISOString();
    return {
      jobId: jobId || uuidv4(),
      type,
      payload,
      status: JOB_STATUS.QUEUED,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      error: null,
      connectionMode: this.connection.mode,
      reprintOf,
    };
  }

  enqueue(job) {
    this.queue.push(job);
    this.idempotency.register(job);
    this.notify();
    this.processNext();
    return job;
  }

  submitText(body) {
    const existing = body.jobId ? this.idempotency.get(body.jobId) : null;
    if (existing) {
      return { job: existing, duplicate: true };
    }

    const payload = buildTextPayload(body);
    const type = body.receipt ? 'receipt' : 'text';
    const job = this.createJob({
      jobId: body.jobId,
      type,
      payload,
    });

    this.enqueue(job);
    return { job, duplicate: false };
  }

  submitImage(body) {
    const existing = body.jobId ? this.idempotency.get(body.jobId) : null;
    if (existing) {
      return { job: existing, duplicate: true };
    }

    const job = this.createJob({
      jobId: body.jobId,
      type: 'image',
      payload: {
        imageBase64: body.imageBase64,
      },
    });

    this.enqueue(job);
    return { job, duplicate: false };
  }

  async reprint(jobId) {
    const stored = await this.failedStore.get(jobId);
    const existing = this.idempotency.get(jobId);

    const source =
      stored ||
      (existing?.status === JOB_STATUS.FAILED ? existing : null);

    if (!source) {
      return null;
    }

    const newJobId = `${jobId}-reprint-${Date.now()}`;
    const job = this.createJob({
      jobId: newJobId,
      type: source.type || existing?.type || 'image',
      payload: source.payload || existing?.payload,
      reprintOf: jobId,
    });

    this.logger.log({
      op: 'reprint',
      conn: this.connection.mode,
      jobId: newJobId,
      status: 'ok',
    });

    this.enqueue(job);
    return job;
  }

  getSummary() {
    const all = this.idempotency.getAll();
    const pending = all.filter((j) => j.status === JOB_STATUS.QUEUED).length;
    const processing = all.filter(
      (j) => j.status === JOB_STATUS.PROCESSING,
    ).length;
    const completed = all.filter(
      (j) => j.status === JOB_STATUS.COMPLETED,
    ).length;
    const failed = all.filter((j) => j.status === JOB_STATUS.FAILED).length;

    return {
      pending,
      processing,
      completed,
      failed,
      queuedIds: this.queue.map((j) => j.jobId),
      jobs: all
        .slice(-20)
        .reverse()
        .map((j) => ({
          jobId: j.jobId,
          type: j.type,
          status: j.status,
          error: j.error,
          createdAt: j.createdAt,
          reprintOf: j.reprintOf || null,
        })),
    };
  }

  async processNext() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      await this.processJob(job);
    }

    this.processing = false;
    this.notify();
  }

  async processJob(job) {
    job.status = JOB_STATUS.PROCESSING;
    job.startedAt = new Date().toISOString();
    this.idempotency.update(job);
    this.notify();

    try {
      if (!this.connection.isConnected()) {
        await this.connection.waitUntilConnected();
      }

      await this.printer.printJob(job);

      job.status = JOB_STATUS.COMPLETED;
      job.completedAt = new Date().toISOString();
      job.error = null;
      this.printer.lastJob = { ...job };

      const op = job.type === 'image' ? 'print_image' : 'print_text';
      this.logger.log({
        op,
        conn: this.connection.mode,
        jobId: job.jobId,
        status: 'ok',
      });

      if (job.reprintOf) {
        await this.failedStore.remove(job.reprintOf);
      }
    } catch (error) {
      job.status = JOB_STATUS.FAILED;
      job.completedAt = new Date().toISOString();
      job.error = {
        code: error.code || 'UNKNOWN',
        detail: error.detail || error.message || 'Print failed',
      };
      this.printer.lastJob = { ...job };

      const op = job.type === 'image' ? 'print_image' : 'print_text';
      this.logger.log({
        op,
        conn: this.connection.mode,
        jobId: job.jobId,
        status: 'error',
        error: job.error,
      });

      if (job.type === 'image' || job.type === 'receipt') {
        await this.failedStore.save(job);
      }
    }

    this.idempotency.update(job);
    this.notify();
  }

  getEtaMs() {
    return this.printer.estimateEtaMs(this.queue.length);
  }
}
