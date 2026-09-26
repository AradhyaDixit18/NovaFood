import { Types } from 'mongoose';
import type { CreateReviewInput, ReviewDTO } from '@novafood/shared';
import type { AppContext } from '../../context';
import { AppError, notFound, unprocessable } from '../../lib/errors';
import { pageMeta } from '../../lib/http';
import { FoodItem } from '../../models/FoodItem';
import { Review, type ReviewLean } from '../../models/misc';
import { Order } from '../../models/Order';
import { Restaurant } from '../../models/Restaurant';
import { User } from '../../models/User';

/** Recomputes cached averages from published reviews only, so moderation is reflected. */
export async function refreshRatings(restaurantId: Types.ObjectId, foodIds: Types.ObjectId[]): Promise<void> {
  const summarize = async (match: Record<string, unknown>) => {
    const filter = { ...match, status: 'PUBLISHED' };
    const [count, [row]] = await Promise.all([
      Review.countDocuments(filter),
      Review.aggregate<{ total: number }>([{ $match: filter }, { $group: { _id: null, total: { $sum: '$rating' } } }]),
    ]);
    return { rating: count ? (row?.total ?? 0) / count : 0, ratingCount: count };
  };
  await Restaurant.updateOne({ _id: restaurantId }, { $set: await summarize({ restaurantId, foodId: null }) });
  for (const foodId of foodIds) {
    await FoodItem.updateOne({ _id: foodId }, { $set: await summarize({ foodId }) });
  }
}

/** Only the customer of a delivered order may review it, once. */
export async function createReview(ctx: AppContext, userId: string, input: CreateReviewInput) {
  const order = await Order.findOne({ _id: input.orderId, userId }).lean();
  if (!order) throw notFound('Order');
  if (order.status !== 'DELIVERED') throw unprocessable('You can review an order once it has been delivered.', 'REVIEW_NOT_ELIGIBLE');
  if (order.reviewed) throw new AppError(409, 'ALREADY_REVIEWED', 'You already reviewed this order.');

  const orderedFoodIds = new Set(order.lines.map((l) => String(l.foodId)));
  const dishes = input.dishes.filter((d) => orderedFoodIds.has(d.foodId));
  const nameById = new Map(order.lines.map((l) => [String(l.foodId), l.name]));

  const claimed = await Order.updateOne({ _id: order._id, reviewed: false }, { $set: { reviewed: true } });
  if (claimed.modifiedCount !== 1) throw new AppError(409, 'ALREADY_REVIEWED', 'You already reviewed this order.');

  await Review.create([
    { userId, orderId: order._id, restaurantId: order.restaurantId, foodId: null, rating: input.rating, comment: input.comment },
    ...dishes.map((d) => ({
      userId,
      orderId: order._id,
      restaurantId: order.restaurantId,
      foodId: new Types.ObjectId(d.foodId),
      foodName: nameById.get(d.foodId) ?? null,
      rating: d.rating,
      comment: d.comment,
    })),
  ]);
  await refreshRatings(order.restaurantId, dishes.map((d) => new Types.ObjectId(d.foodId)));
  ctx.logger.info({ orderId: String(order._id) }, 'Review created');
}

export async function toReviewDTOs(rows: ReviewLean[], viewerId?: string): Promise<ReviewDTO[]> {
  const users = await User.find({ _id: { $in: rows.map((r) => r.userId) } }).select('name avatarUrl').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return rows.map((r) => {
    const u = byId.get(String(r.userId));
    return {
      _id: String(r._id),
      // Reviews show a first name and initial only.
      user: { _id: String(r.userId), name: u ? shortName(u.name) : 'NovaFood user', avatarUrl: u?.avatarUrl ?? null },
      restaurantId: String(r.restaurantId),
      foodId: r.foodId ? String(r.foodId) : null,
      foodName: r.foodName ?? null,
      rating: r.rating,
      comment: r.comment ?? undefined,
      helpfulCount: r.helpfulCount ?? 0,
      markedHelpful: viewerId ? (r.helpfulBy ?? []).some((id) => String(id) === viewerId) : false,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

function shortName(name: string): string {
  const [first, last] = name.trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : (first ?? name);
}

export async function listReviews(
  q: { restaurantId?: string; foodId?: string; page: number; limit: number; status?: 'PUBLISHED' | 'HIDDEN' },
  viewerId?: string,
) {
  const filter: Record<string, unknown> = { status: q.status ?? 'PUBLISHED' };
  if (q.restaurantId) filter.restaurantId = q.restaurantId;
  if (q.foodId) filter.foodId = q.foodId;
  const [rows, total] = await Promise.all([
    Review.find(filter).sort({ helpfulCount: -1, createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Review.countDocuments(filter),
  ]);
  return { items: await toReviewDTOs(rows as ReviewLean[], viewerId), meta: pageMeta(q.page, q.limit, total) };
}

export async function toggleHelpful(userId: string, reviewId: string) {
  const review = await Review.findOne({ _id: reviewId, status: 'PUBLISHED' }).lean();
  if (!review) throw notFound('Review');
  if (String(review.userId) === userId) throw unprocessable('You cannot vote on your own review.');
  const already = (review.helpfulBy ?? []).some((id) => String(id) === userId);
  const updated = await Review.findByIdAndUpdate(
    reviewId,
    already ? { $pull: { helpfulBy: userId }, $inc: { helpfulCount: -1 } } : { $addToSet: { helpfulBy: userId }, $inc: { helpfulCount: 1 } },
    { new: true },
  ).lean();
  return { helpful: !already, helpfulCount: updated?.helpfulCount ?? 0 };
}

export async function moderateReview(ctx: AppContext, reviewId: string, adminId: string, status: 'PUBLISHED' | 'HIDDEN', note?: string) {
  const review = await Review.findByIdAndUpdate(
    reviewId,
    { $set: { status, moderatedBy: adminId, moderationNote: note } },
    { new: true },
  ).lean();
  if (!review) throw notFound('Review');
  await refreshRatings(review.restaurantId, review.foodId ? [review.foodId] : []);
  ctx.logger.info({ reviewId, status }, 'Review moderated');
  return review;
}
