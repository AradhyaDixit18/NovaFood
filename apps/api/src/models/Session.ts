import { Schema, model } from 'mongoose';
import { supportsTtlIndexes } from './compat';

/**
 * A refresh-token session. Tokens are stored as SHA-256 hashes and rotated on every refresh.
 * All sessions created from one login share a `family`; presenting an already-rotated token
 * revokes the whole family (refresh-token reuse detection).
 */
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    rotatedAt: { type: Date, default: null },
    userAgent: String,
    ip: String,
  },
  { timestamps: true },
);

if (supportsTtlIndexes) sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
else sessionSchema.index({ expiresAt: 1 });

export const Session = model('Session', sessionSchema);
