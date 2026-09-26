import { type Types } from 'mongoose';
import { conflict } from '../../lib/errors';
import { PointsEntry } from '../../models/misc';
import { User } from '../../models/User';

/**
 * Nova Points use a ledger (every change is an entry) plus a cached balance on the user.
 * Debits are conditional updates, so the balance can never go negative under concurrency.
 */

export async function debitPoints(userId: string, points: number, orderId: Types.ObjectId, description: string): Promise<void> {
  if (points <= 0) return;
  const result = await User.updateOne({ _id: userId, pointsBalance: { $gte: points } }, { $inc: { pointsBalance: -points } });
  if (result.modifiedCount !== 1) throw conflict('Your Nova Points balance changed. Please review your cart.', 'POINTS_CHANGED');
  await PointsEntry.create({ userId, type: 'REDEEM', points: -points, description, orderId });
}

export async function creditPoints(
  userId: string,
  points: number,
  type: 'EARN' | 'REVERSE' | 'BONUS',
  description: string,
  orderId: Types.ObjectId | null,
): Promise<boolean> {
  if (points <= 0) return false;
  // One EARN / REVERSE per order, even if an event is processed twice.
  if (orderId && (type === 'EARN' || type === 'REVERSE')) {
    const exists = await PointsEntry.exists({ orderId, type });
    if (exists) return false;
  }
  await PointsEntry.create({ userId, type, points, description, orderId });
  await User.updateOne({ _id: userId }, { $inc: { pointsBalance: points } });
  return true;
}
