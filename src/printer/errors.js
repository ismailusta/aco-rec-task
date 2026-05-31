export const ERROR_CODES = {
  PAPER_OUT: 'PAPER_OUT',
  PAPER_JAM: 'PAPER_JAM',
  COVER_OPEN: 'COVER_OPEN',
  OVERHEAT: 'OVERHEAT',
  COMM_ERROR: 'COMM_ERROR',
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
};

export const HARDWARE_ERRORS = [
  ERROR_CODES.PAPER_OUT,
  ERROR_CODES.PAPER_JAM,
  ERROR_CODES.COVER_OPEN,
  ERROR_CODES.OVERHEAT,
];

export const ERROR_MESSAGES = {
  tr: {
    [ERROR_CODES.PAPER_OUT]: 'Kağıt bitti',
    [ERROR_CODES.PAPER_JAM]: 'Kağıt sıkışması',
    [ERROR_CODES.COVER_OPEN]: 'Kapak açık',
    [ERROR_CODES.OVERHEAT]: 'Aşırı ısınma',
    [ERROR_CODES.COMM_ERROR]: 'İletişim hatası',
    [ERROR_CODES.UNKNOWN_COMMAND]: 'Bilinmeyen komut',
  },
  en: {
    [ERROR_CODES.PAPER_OUT]: 'Paper out',
    [ERROR_CODES.PAPER_JAM]: 'Paper jam',
    [ERROR_CODES.COVER_OPEN]: 'Cover open',
    [ERROR_CODES.OVERHEAT]: 'Overheat',
    [ERROR_CODES.COMM_ERROR]: 'Communication error',
    [ERROR_CODES.UNKNOWN_COMMAND]: 'Unknown command',
  },
};

export const ERROR_DETAILS = {
  [ERROR_CODES.PAPER_OUT]: 'No paper detected',
  [ERROR_CODES.PAPER_JAM]: 'Paper jam detected during print',
  [ERROR_CODES.COVER_OPEN]: 'Printer cover is open',
  [ERROR_CODES.OVERHEAT]: 'Printer temperature too high',
  [ERROR_CODES.COMM_ERROR]: 'Connection lost during operation',
  [ERROR_CODES.UNKNOWN_COMMAND]: 'Invalid or unsupported command',
};

export function getErrorMessage(code, lang = 'tr') {
  const messages = ERROR_MESSAGES[lang] || ERROR_MESSAGES.tr;
  return messages[code] || code;
}

export function pickRandomHardwareError() {
  const index = Math.floor(Math.random() * HARDWARE_ERRORS.length);
  return HARDWARE_ERRORS[index];
}

export function isValidErrorCode(code) {
  return Object.values(ERROR_CODES).includes(code);
}
