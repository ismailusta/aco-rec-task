import fs from 'fs/promises';
import path from 'path';

const FAILED_DIR = path.resolve('data/failed-jobs');

export class FailedJobStore {
  constructor() {
    this.initialized = false;
  }

  async ensureDir() {
    if (!this.initialized) {
      await fs.mkdir(FAILED_DIR, { recursive: true });
      this.initialized = true;
    }
  }

  async save(job) {
    await this.ensureDir();
    const metaPath = path.join(FAILED_DIR, `${job.jobId}.json`);
    const payload = {
      jobId: job.jobId,
      type: job.type,
      error: job.error,
      failedAt: job.completedAt || new Date().toISOString(),
      payload: job.payload,
    };

    await fs.writeFile(metaPath, JSON.stringify(payload, null, 2), 'utf8');

    if (job.type === 'image' && job.payload?.imageBase64) {
      const imagePath = path.join(FAILED_DIR, `${job.jobId}.b64`);
      await fs.writeFile(imagePath, job.payload.imageBase64, 'utf8');
    }

    return payload;
  }

  async list() {
    await this.ensureDir();
    const files = await fs.readdir(FAILED_DIR);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));
    const results = [];

    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(FAILED_DIR, file), 'utf8');
      const meta = JSON.parse(content);
      const hasImage = files.includes(`${meta.jobId}.b64`);
      results.push({
        jobId: meta.jobId,
        type: meta.type,
        error: meta.error,
        failedAt: meta.failedAt,
        previewUrl: hasImage ? `/failed-jobs/${meta.jobId}/preview` : null,
      });
    }

    return results.sort(
      (a, b) => new Date(b.failedAt).getTime() - new Date(a.failedAt).getTime(),
    );
  }

  async get(jobId) {
    await this.ensureDir();
    const metaPath = path.join(FAILED_DIR, `${jobId}.json`);
    try {
      const content = await fs.readFile(metaPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async getImageBase64(jobId) {
    await this.ensureDir();
    const imagePath = path.join(FAILED_DIR, `${jobId}.b64`);
    try {
      return await fs.readFile(imagePath, 'utf8');
    } catch {
      return null;
    }
  }

  async remove(jobId) {
    await this.ensureDir();
    const targets = [
      path.join(FAILED_DIR, `${jobId}.json`),
      path.join(FAILED_DIR, `${jobId}.b64`),
    ];

    for (const target of targets) {
      try {
        await fs.unlink(target);
      } catch {
        // ignore missing files
      }
    }
  }
}
