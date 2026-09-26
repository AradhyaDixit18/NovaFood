export type ErrorDetails = Record<string, string[]>;

/** An error that is safe to show to the client. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: ErrorDetails) => new AppError(400, 'BAD_REQUEST', message, details);
export const validationError = (details: ErrorDetails, message = 'Some fields need attention.') =>
  new AppError(422, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Please log in to continue.', code = 'UNAUTHORIZED') => new AppError(401, code, message);
export const forbidden = (message = 'You do not have access to this.', code = 'FORBIDDEN') => new AppError(403, code, message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);
export const unprocessable = (message: string, code = 'UNPROCESSABLE') => new AppError(422, code, message);
export const serviceUnavailable = (message: string, code = 'SERVICE_UNAVAILABLE') => new AppError(503, code, message);
