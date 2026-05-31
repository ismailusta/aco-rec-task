import { config } from './config/env.js';
import { createApp } from './app.js';

const { app } = createApp();

const server = app.listen(config.port, () => {
  console.log(
    `Thermal printer service listening on http://localhost:${config.port}`,
  );
});

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
