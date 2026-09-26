import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { MulterError } from 'multer';
import type { AppContext } from '../context';
import { AppError } from '../lib/errors';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
};

/** Converts every error into the standard `{ error: { code, message, details } }` shape. */
export function errorHandler(ctx: AppContext): ErrorRequestHandler {
  return (err, req, res, _next) => {
    let appError: AppError;

    if (err instanceof AppError) {
      appError = err;
    } else if (err instanceof mongoose.Error.CastError) {
      appError = new AppError(400, 'INVALID_ID', 'That id is not valid.');
    } else if (err instanceof mongoose.Error.ValidationError) {
      const details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, [v.message]]));
      appError = new AppError(422, 'VALIDATION_ERROR', 'Some fields need attention.', details);
    } else if (err instanceof MulterError) {
      appError = new AppError(400, 'UPLOAD_ERROR', err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 3 MB or smaller.' : err.message);
    } else if (typeof err === 'object' && err && 'code' in err && err.code === 11000) {
      appError = new AppError(409, 'DUPLICATE', 'That already exists.');
    } else if (typeof err === 'object' && err && 'type' in err && err.type === 'entity.parse.failed') {
      appError = new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON.');
    } else if (typeof err === 'object' && err && 'type' in err && err.type === 'entity.too.large') {
      appError = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
    } else {
      appError = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
    }

    if (appError.status >= 500) {
      if (process.env.DEBUG_ERRORS) console.error(err);
      (req.log ?? ctx.logger).error({ err }, 'Unhandled error');
    }

    res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details ? { details: appError.details } : {}),
      },
    });
  };
}
