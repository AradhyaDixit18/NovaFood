import { Router } from 'express';
import { Types } from 'mongoose';
import { addressSchema, idParams, updateProfileSchema } from '@novafood/shared';
import type { AppContext } from '../../context';
import { badRequest, notFound } from '../../lib/errors';
import { parse, send } from '../../lib/http';
import { authenticate, currentUser } from '../../middleware/auth';
import { Order } from '../../models/Order';
import { Favorite, Review } from '../../models/misc';
import { User } from '../../models/User';
import { toAddressDTO, toOrderDTO, toUserDTO } from '../../serializers';

const MAX_ADDRESSES = 10;

export function createUsersRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(authenticate(ctx, { required: true }));

  router.patch('/me', async (req, res) => {
    const input = parse(updateProfileSchema, req.body);
    const userId = currentUser(req).id;
    const set: Record<string, unknown> = {};
    for (const key of ['name', 'phone', 'avatarUrl', 'dietaryPreferences', 'vegetarianOnly', 'favoriteCuisines'] as const) {
      if (input[key] !== undefined) set[key] = input[key];
    }
    // Merge nested settings field by field so a partial update never resets the others.
    for (const [k, v] of Object.entries(input.notificationPrefs ?? {})) set[`notificationPrefs.${k}`] = v;
    for (const [k, v] of Object.entries(input.privacy ?? {})) set[`privacy.${k}`] = v;
    await User.updateOne({ _id: userId }, { $set: set }, { runValidators: true });
    const user = await User.findById(userId).lean();
    send(res, { user: toUserDTO(user) });
  });

  router.get('/me/addresses', async (req, res) => {
    const user = await User.findById(currentUser(req).id).select('addresses').lean();
    send(res, (user?.addresses ?? []).map(toAddressDTO));
  });

  router.post('/me/addresses', async (req, res) => {
    const input = parse(addressSchema, req.body);
    const user = await User.findById(currentUser(req).id);
    if (!user) throw notFound('User');
    if (user.addresses.length >= MAX_ADDRESSES) throw badRequest(`You can save up to ${MAX_ADDRESSES} addresses.`);
    const makeDefault = input.isDefault || user.addresses.length === 0;
    if (makeDefault) user.addresses.forEach((a) => (a.isDefault = false));
    user.addresses.push({ ...input, isDefault: makeDefault });
    await user.save();
    send(res, toAddressDTO(user.addresses[user.addresses.length - 1]), 201);
  });

  router.patch('/me/addresses/:id', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const input = parse(addressSchema.partial(), req.body);
    const user = await User.findById(currentUser(req).id);
    const address = user?.addresses.id(id);
    if (!user || !address) throw notFound('Address');
    if (input.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
    address.set(input);
    await user.save();
    send(res, toAddressDTO(address));
  });

  router.delete('/me/addresses/:id', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const user = await User.findById(currentUser(req).id);
    const address = user?.addresses.id(id);
    if (!user || !address) throw notFound('Address');
    const wasDefault = address.isDefault;
    address.deleteOne();
    if (wasDefault && user.addresses[0]) user.addresses[0].isDefault = true;
    await user.save();
    send(res, { ok: true });
  });

  /** Privacy: everything we store about the caller, as JSON. */
  router.get('/me/export', async (req, res) => {
    const userId = new Types.ObjectId(currentUser(req).id);
    const [user, orders, reviews, favorites] = await Promise.all([
      User.findById(userId).lean(),
      Order.find({ userId }).sort({ createdAt: -1 }).lean(),
      Review.find({ userId }).lean(),
      Favorite.find({ userId }).lean(),
    ]);
    res.setHeader('Content-Disposition', 'attachment; filename="novafood-data.json"');
    send(res, {
      exportedAt: ctx.now().toISOString(),
      profile: toUserDTO(user),
      orders: orders.map((o) => toOrderDTO(o)),
      reviews: reviews.map((r) => ({ restaurantId: String(r.restaurantId), foodId: r.foodId ? String(r.foodId) : null, rating: r.rating, comment: r.comment, createdAt: r.createdAt })),
      favorites: favorites.map((f) => ({ kind: f.kind, targetId: String(f.targetId) })),
    });
  });

  return router;
}
