import bcrypt from 'bcryptjs';
import type { LoginInput, RegisterInput } from '@novafood/shared';
import { primaryClientUrl } from '../../config/env';
import type { AppContext } from '../../context';
import { emailTemplates } from '../../integrations/email';
import { AppError, badRequest, conflict, forbidden, unauthorized } from '../../lib/errors';
import { hashToken, randomToken, signAccessToken } from '../../lib/tokens';
import { Session } from '../../models/Session';
import { User } from '../../models/User';

const BCRYPT_ROUNDS = 12;
/** Cheaper hashing keeps the test suite fast; production always uses 12 rounds. */
const rounds = (ctx: AppContext) => (ctx.env.NODE_ENV === 'test' ? 4 : BCRYPT_ROUNDS);
const VERIFY_TTL_MS = 24 * 60 * 60_000;
const RESET_TTL_MS = 30 * 60_000;
/** Two tabs refreshing at the same moment must not be mistaken for token theft. */
const ROTATION_GRACE_MS = 15_000;

const dummyHashes = new Map<number, string>();
/** A real hash at the same cost as stored passwords, so unknown emails take as long as wrong passwords. */
function dummyHash(ctx: AppContext): string {
  const cost = rounds(ctx);
  if (!dummyHashes.has(cost)) dummyHashes.set(cost, bcrypt.hashSync('no-such-user-placeholder', cost));
  return dummyHashes.get(cost)!;
}

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

async function issueSession(ctx: AppContext, user: { _id: unknown; role: string }, family: string, meta: SessionMeta): Promise<IssuedTokens> {
  const refreshToken = randomToken(48);
  const refreshExpiresAt = new Date(ctx.now().getTime() + ctx.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await Session.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: refreshExpiresAt,
    userAgent: meta.userAgent?.slice(0, 200),
    ip: meta.ip,
  });
  const accessToken = signAccessToken(ctx.env, { sub: String(user._id), role: user.role as never });
  return { accessToken, refreshToken, refreshExpiresAt };
}

async function sendVerificationEmail(ctx: AppContext, user: { _id: unknown; name: string; email: string }): Promise<void> {
  const token = randomToken();
  await User.updateOne(
    { _id: user._id },
    { emailVerifyTokenHash: hashToken(token), emailVerifyExpiresAt: new Date(ctx.now().getTime() + VERIFY_TTL_MS) },
  );
  const link = `${primaryClientUrl(ctx.env)}/verify-email?token=${encodeURIComponent(token)}`;
  try {
    await ctx.email.send({ to: user.email, ...emailTemplates.verifyEmail(user.name, link) });
  } catch (err) {
    // Registration must not fail because an email provider hiccupped; the user can resend.
    ctx.logger.error({ err, userId: String(user._id) }, 'Failed to send verification email');
  }
}

export async function register(ctx: AppContext, input: RegisterInput, meta: SessionMeta) {
  const existing = await User.exists({ email: input.email });
  if (existing) throw conflict('An account with this email already exists. Try logging in.', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(input.password, rounds(ctx));
  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    passwordHash,
    lastLoginAt: ctx.now(),
  });
  await sendVerificationEmail(ctx, user);
  const tokens = await issueSession(ctx, user, randomToken(12), meta);
  return { user: await User.findById(user._id).lean(), ...tokens };
}

export async function login(ctx: AppContext, input: LoginInput, meta: SessionMeta) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  // Compare against a dummy hash when the email is unknown so response timing does not reveal it.
  const hash = user?.passwordHash ?? dummyHash(ctx);
  const valid = await bcrypt.compare(input.password, hash);
  if (!user || !valid) throw unauthorized('Email or password is incorrect.', 'INVALID_CREDENTIALS');
  if (user.status !== 'ACTIVE') throw forbidden('This account is suspended. Contact support.', 'ACCOUNT_SUSPENDED');

  user.lastLoginAt = ctx.now();
  await user.save();
  const tokens = await issueSession(ctx, user, randomToken(12), meta);
  return { user: await User.findById(user._id).lean(), ...tokens };
}

/** Rotates a refresh token. Reusing an old token revokes every session in its family. */
export async function refresh(ctx: AppContext, rawToken: string | undefined, meta: SessionMeta) {
  if (!rawToken) throw unauthorized('Please log in to continue.', 'NO_SESSION');
  const now = ctx.now();
  const tokenHash = hashToken(rawToken);

  const claimed = await Session.findOneAndUpdate(
    { tokenHash, rotatedAt: null, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { rotatedAt: now } },
    { new: true },
  );

  let session = claimed;
  if (!session) {
    const existing = await Session.findOne({ tokenHash });
    if (!existing || existing.expiresAt <= now) throw unauthorized('Your session expired. Please log in again.', 'SESSION_EXPIRED');
    const withinGrace = existing.rotatedAt && !existing.revokedAt && now.getTime() - existing.rotatedAt.getTime() < ROTATION_GRACE_MS;
    if (!withinGrace) {
      await Session.updateMany({ family: existing.family, revokedAt: null }, { $set: { revokedAt: now } });
      ctx.logger.warn({ userId: String(existing.userId), family: existing.family }, 'Refresh token reuse detected; family revoked');
      throw unauthorized('Your session ended for security reasons. Please log in again.', 'SESSION_REVOKED');
    }
    session = existing;
  }

  const user = await User.findById(session.userId).lean();
  if (!user) throw unauthorized('Please log in to continue.', 'NO_SESSION');
  if (user.status !== 'ACTIVE') {
    await Session.updateMany({ userId: user._id }, { $set: { revokedAt: now } });
    throw forbidden('This account is suspended. Contact support.', 'ACCOUNT_SUSPENDED');
  }
  const tokens = await issueSession(ctx, user, session.family, meta);
  return { user, ...tokens };
}

export async function logout(ctx: AppContext, rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const session = await Session.findOne({ tokenHash: hashToken(rawToken) });
  if (session) await Session.updateMany({ family: session.family }, { $set: { revokedAt: ctx.now() } });
}

export async function logoutEverywhere(ctx: AppContext, userId: string): Promise<void> {
  await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: ctx.now() } });
}

export async function verifyEmail(ctx: AppContext, token: string) {
  const user = await User.findOne({
    emailVerifyTokenHash: hashToken(token),
    emailVerifyExpiresAt: { $gt: ctx.now() },
  });
  if (!user) throw badRequest('This verification link is invalid or has expired.');
  user.emailVerified = true;
  user.emailVerifyTokenHash = undefined;
  user.emailVerifyExpiresAt = undefined;
  await user.save();
  return User.findById(user._id).lean();
}

export async function resendVerification(ctx: AppContext, userId: string): Promise<void> {
  const user = await User.findById(userId).lean();
  if (!user) throw unauthorized();
  if (user.emailVerified) throw new AppError(400, 'ALREADY_VERIFIED', 'Your email is already verified.');
  await sendVerificationEmail(ctx, user);
}

/** Always resolves the same way, so the endpoint cannot be used to discover accounts. */
export async function forgotPassword(ctx: AppContext, email: string): Promise<void> {
  const user = await User.findOne({ email }).lean();
  if (!user || user.status !== 'ACTIVE') return;
  const token = randomToken();
  await User.updateOne(
    { _id: user._id },
    { passwordResetTokenHash: hashToken(token), passwordResetExpiresAt: new Date(ctx.now().getTime() + RESET_TTL_MS) },
  );
  const link = `${primaryClientUrl(ctx.env)}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await ctx.email.send({ to: user.email, ...emailTemplates.resetPassword(user.name, link) });
  } catch (err) {
    ctx.logger.error({ err, userId: String(user._id) }, 'Failed to send password reset email');
  }
}

export async function resetPassword(ctx: AppContext, token: string, password: string): Promise<void> {
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: { $gt: ctx.now() },
  });
  if (!user) throw badRequest('This reset link is invalid or has expired.');
  user.passwordHash = await bcrypt.hash(password, rounds(ctx));
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  // Proving control of the inbox is also proof of email ownership.
  user.emailVerified = true;
  await user.save();
  await logoutEverywhere(ctx, String(user._id));
}

export async function changePassword(ctx: AppContext, userId: string, current: string, next: string): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw unauthorized();
  if (!(await bcrypt.compare(current, user.passwordHash))) {
    throw new AppError(400, 'WRONG_PASSWORD', 'Your current password is incorrect.');
  }
  user.passwordHash = await bcrypt.hash(next, rounds(ctx));
  await user.save();
  await logoutEverywhere(ctx, userId);
}
