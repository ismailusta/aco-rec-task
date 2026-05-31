import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { calculateBackoffDelay } from '../src/printer/ConnectionManager.js';

describe('Thermal Printer API', () => {
  let app;

  beforeEach(() => {
    ({ app } = createApp());
  });

  it('connects via usb and lan', async () => {
    const usb = await request(app)
      .post('/connect')
      .send({ mode: 'usb' })
      .expect(200);

    expect(usb.body.connection.mode).toBe('usb');
    expect(usb.body.connection.status).toBe('connected');

    const lan = await request(app)
      .post('/connect')
      .send({ mode: 'lan' })
      .expect(200);

    expect(lan.body.connection.mode).toBe('lan');
  });

  it('rejects invalid connect mode with UNKNOWN_COMMAND', async () => {
    const res = await request(app)
      .post('/connect')
      .send({ mode: 'wifi' })
      .expect(400);

    expect(res.body.error.code).toBe('UNKNOWN_COMMAND');
  });

  it('returns idempotent response for duplicate jobId', async () => {
    await request(app).post('/connect').send({ mode: 'usb' });

    const first = await request(app)
      .post('/print/text')
      .send({ jobId: 'dup-1', text: 'hello', lang: 'tr' })
      .expect(202);

    const second = await request(app)
      .post('/print/text')
      .send({ jobId: 'dup-1', text: 'hello', lang: 'tr' })
      .expect(200);

    expect(first.body.job.jobId).toBe('dup-1');
    expect(second.body.duplicate).toBe(true);
    expect(second.body.job.jobId).toBe('dup-1');
  });

  it('logs operations using task schema fields', async () => {
    await request(app).post('/connect').send({ mode: 'usb' });
    await request(app)
      .post('/print/text')
      .send({ jobId: 'log-1', text: 'log test', lang: 'en' });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const logs = await request(app).get('/logs').expect(200);
    const entry = logs.body.find((item) => item.jobId === 'log-1');

    expect(entry).toBeTruthy();
    expect(entry).toMatchObject({
      op: 'print_text',
      conn: 'usb',
      jobId: 'log-1',
      status: 'ok',
    });
    expect(entry.ts).toBeTruthy();
    expect(entry.error).toBeNull();
  });

  it('exports logs as csv', async () => {
    await request(app).post('/connect').send({ mode: 'usb' });

    const res = await request(app).get('/logs?format=csv').expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('ts,op,conn,jobId,status,errorCode,errorDetail');
  });

  it('reprints a failed image job', async () => {
    await request(app).post('/connect').send({ mode: 'usb' });

    await request(app)
      .post('/simulate/error')
      .send({ code: 'PAPER_JAM' })
      .expect(200);

    const imageBase64 = Buffer.from('fake-image').toString('base64');
    const failed = await request(app)
      .post('/print/image')
      .send({ jobId: 'fail-img-1', imageBase64 })
      .expect(202);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(failed.body.job.jobId).toBe('fail-img-1');

    await request(app).post('/simulate/clear').send({}).expect(200);

    const reprint = await request(app)
      .post('/reprint')
      .send({ jobId: 'fail-img-1' })
      .expect(202);

    expect(reprint.body.job.reprintOf).toBe('fail-img-1');
  });

  it('returns health status', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });
});

describe('ConnectionManager backoff', () => {
  it('increases reconnect delay exponentially', () => {
    expect(calculateBackoffDelay(1, 1000, 30000)).toBe(1000);
    expect(calculateBackoffDelay(2, 1000, 30000)).toBe(2000);
    expect(calculateBackoffDelay(3, 1000, 30000)).toBe(4000);
    expect(calculateBackoffDelay(10, 1000, 30000)).toBe(30000);
  });
});
