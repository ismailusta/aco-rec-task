import { Router } from 'express';
import { config } from '../config/env.js';
import { createControllers } from './controllers.js';
import {
  optionalAuth,
  validateConnect,
  validatePrintImage,
  validatePrintText,
  validateReprint,
  validateSimulateError,
} from './middleware.js';

export function createRouter(services) {
  const router = Router();
  const controllers = createControllers(services);
  const auth = optionalAuth(config);

  router.get('/health', auth, controllers.health);
  router.post('/connect', auth, validateConnect, controllers.connect);
  router.post('/print/text', auth, validatePrintText, controllers.printText);
  router.post('/print/image', auth, validatePrintImage, controllers.printImage);
  router.get('/status', auth, controllers.status);
  router.get('/logs', auth, controllers.logs);
  router.post('/reprint', auth, validateReprint, controllers.reprint);
  router.post(
    '/simulate/error',
    auth,
    validateSimulateError,
    controllers.simulateError,
  );
  router.post('/simulate/clear', auth, controllers.clearError);
  router.get('/failed-jobs/:jobId/preview', auth, controllers.failedPreview);

  return router;
}
