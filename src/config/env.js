import dotenv from 'dotenv';

dotenv.config();

function int(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

function float(name, fallback) {
  const value = Number.parseFloat(process.env[name] ?? '');
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  port: int('PORT', 3000),
  apiToken: process.env.API_TOKEN || '',
  connectDelayMs: int('CONNECT_DELAY_MS', 800),
  printDelayMs: int('PRINT_DELAY_MS', 1200),
  disconnectProbability: float('DISCONNECT_PROBABILITY', 0.03),
  errorProbability: float('ERROR_PROBABILITY', 0.12),
  backoffBaseMs: int('BACKOFF_BASE_MS', 1000),
  backoffMaxMs: int('BACKOFF_MAX_MS', 30000),
  defaultLang: process.env.DEFAULT_LANG || 'tr',
  logMaxEntries: int('LOG_MAX_ENTRIES', 500),
  paperRollPercent: int('PAPER_ROLL_PERCENT', 85),
};
