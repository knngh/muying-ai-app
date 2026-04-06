import { NextFunction, Request, Response } from 'express';
import { AppError, ErrorCodes } from './error.middleware';
import { authMiddleware } from './auth.middleware';
import { env } from '../config/env';
import {
  type PaymentCallbackPayload,
  type PaymentProvider,
  verifyPaymentCallbackSignature,
} from '../services/payment-callback.service';

declare global {
  namespace Express {
    interface Request {
      paymentCallbackAuth?: {
        mode: 'signature' | 'auth';
        provider: PaymentProvider;
      };
    }
  }
}

export function paymentCallbackAccessMiddleware(provider: PaymentProvider) {
  return (req: Request, res: Response, next: NextFunction) => {
    const hasSignatureHeaders = Boolean(
      req.header('x-payment-timestamp') || req.header('x-payment-signature'),
    );
    const verification = verifyPaymentCallbackSignature({
      provider,
      timestamp: req.header('x-payment-timestamp'),
      signature: req.header('x-payment-signature'),
      payload: req.body as PaymentCallbackPayload,
    });

    if (verification.verified) {
      req.paymentCallbackAuth = {
        mode: 'signature',
        provider,
      };
      return next();
    }

    const hasAuthHeader = Boolean(req.headers.authorization?.startsWith('Bearer '));
    if (!hasSignatureHeaders && hasAuthHeader && env.PAYMENT_CALLBACK_ALLOW_AUTH_FALLBACK) {
      return authMiddleware(req, res, (error?: unknown) => {
        if (error) {
          return next(error);
        }

        req.paymentCallbackAuth = {
          mode: 'auth',
          provider,
        };
        return next();
      });
    }

    if (verification.code === 'config') {
      return next(new AppError(verification.reason, ErrorCodes.SERVER_ERROR, 503));
    }

    const statusCode = verification.code === 'missing' ? 401 : 403;
    return next(new AppError(verification.reason, ErrorCodes.NO_PERMISSION, statusCode));
  };
}
