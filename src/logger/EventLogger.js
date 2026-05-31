import { config } from '../config/env.js';

export class EventLogger {
  constructor(maxEntries = config.logMaxEntries) {
    this.maxEntries = maxEntries;
    this.entries = [];
  }

  log({ op, conn = null, jobId = null, status, error = null }) {
    const entry = {
      ts: new Date().toISOString(),
      op,
      conn,
      jobId,
      status,
      error: error
        ? {
            code: error.code,
            detail: error.detail || error.message || '',
          }
        : null,
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    return entry;
  }

  getAll() {
    return [...this.entries];
  }

  getRecent(limit = 100) {
    return this.entries.slice(-limit);
  }

  toCsv() {
    const header = 'ts,op,conn,jobId,status,errorCode,errorDetail';
    const rows = this.entries.map((entry) => {
      const errorCode = entry.error?.code ?? '';
      const errorDetail = (entry.error?.detail ?? '').replace(/"/g, '""');
      return [
        entry.ts,
        entry.op,
        entry.conn ?? '',
        entry.jobId ?? '',
        entry.status,
        errorCode,
        `"${errorDetail}"`,
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  exportSnapshot() {
    return this.getAll();
  }
}
