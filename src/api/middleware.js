import { ERROR_CODES, isValidErrorCode } from '../printer/errors.js';

export function optionalAuth(config) {
  return (req, res, next) => {
    if (!config.apiToken) {
      return next();
    }

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ')
      ? header.slice(7)
      : req.headers['x-api-token'];

    if (token !== config.apiToken) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          detail: 'Invalid or missing API token',
        },
      });
    }

    return next();
  };
}

export function validateConnect(req, res, next) {
  const { mode } = req.body || {};
  if (mode !== 'usb' && mode !== 'lan') {
    return res.status(400).json({
      error: {
        code: ERROR_CODES.UNKNOWN_COMMAND,
        detail: 'mode must be "usb" or "lan"',
      },
    });
  }
  return next();
}

export function validatePrintText(req, res, next) {
  const body = req.body || {};
  if (!body.text && !body.receipt) {
    return res.status(400).json({
      error: {
        code: ERROR_CODES.UNKNOWN_COMMAND,
        detail: 'text or receipt is required',
      },
    });
  }
  return next();
}

export function validatePrintImage(req, res, next) {
  const body = req.body || {};
  if (!body.imageBase64 || typeof body.imageBase64 !== 'string') {
    return res.status(400).json({
      error: {
        code: ERROR_CODES.UNKNOWN_COMMAND,
        detail: 'imageBase64 is required',
      },
    });
  }

  const normalized = body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
  if (!/^[A-Za-z0-9+/=\s]+$/.test(normalized)) {
    return res.status(400).json({
      error: {
        code: ERROR_CODES.UNKNOWN_COMMAND,
        detail: 'Invalid base64 image data',
      },
    });
  }

  req.body.imageBase64 = normalized.trim();
  return next();
}

export function validateReprint(req, res, next) {
  const { jobId } = req.body || {};
  if (!jobId) {
    return res.status(400).json({
      error: {
        code: ERROR_CODES.UNKNOWN_COMMAND,
        detail: 'jobId is required',
      },
    });
  }
  return next();
}

export function validateSimulateError(req, res, next) {
  const { code } = req.body || {};
  if (!isValidErrorCode(code) || code === ERROR_CODES.UNKNOWN_COMMAND) {
    return res.status(400).json({
      error: {
        code: ERROR_CODES.UNKNOWN_COMMAND,
        detail: 'Valid error code is required',
      },
    });
  }
  return next();
}
