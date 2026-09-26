import { z } from 'zod';
import { phone } from './common';

export const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(160);

export const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name').max(60),
  email,
  password,
  phone: phone.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password').max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password,
});

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: password,
});
