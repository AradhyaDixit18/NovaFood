import type { Role } from '@novafood/shared';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      role: Role;
      name: string;
      email: string;
      emailVerified: boolean;
    }
    interface Request {
      user?: AuthUser;
      /** Raw request bytes, kept only for webhook signature checks. */
      rawBody?: Buffer;
    }
  }
}

export {};
