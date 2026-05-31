export class IdempotencyRegistry {
  constructor() {
    this.jobsById = new Map();
  }

  register(job) {
    this.jobsById.set(job.jobId, job);
    return job;
  }

  get(jobId) {
    return this.jobsById.get(jobId) || null;
  }

  has(jobId) {
    return this.jobsById.has(jobId);
  }

  update(job) {
    this.jobsById.set(job.jobId, job);
    return job;
  }

  getAll() {
    return [...this.jobsById.values()];
  }
}
