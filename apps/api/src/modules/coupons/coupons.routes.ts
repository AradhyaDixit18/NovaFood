import { Router } from 'express';
import { type CouponDTO, describeCoupon } from '@novafood/shared';
import type { AppContext } from '../../context';
import { send } from '../../lib/http';
import { authenticate } from '../../middleware/auth';
import { Coupon, type CouponLean } from '../../models/misc';

export function toCouponDTO(c: CouponLean): CouponDTO {
  return {
    _id: String(c._id),
    code: c.code,
    description: c.description || describeCoupon(c),
    type: c.type,
    value: c.value,
    minOrderPaise: c.minOrderPaise ?? 0,
    maxDiscountPaise: c.maxDiscountPaise ?? null,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    firstOrderOnly: c.firstOrderOnly,
    restaurantIds: (c.restaurantIds ?? []).map(String),
  };
}

export function createCouponsRouter(ctx: AppContext): Router {
  const router = Router();

  /** Offers the caller can use right now: public ones plus any targeted at them. */
  router.get('/', authenticate(ctx, { required: false }), async (req, res) => {
    const now = ctx.now();
    const audience = req.user ? { $or: [{ userIds: { $size: 0 } }, { userIds: req.user.id }] } : { userIds: { $size: 0 } };
    const rows = (await Coupon.find({
      isActive: true,
      $and: [
        audience,
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()) as CouponLean[];
    const available = rows.filter((c) => c.usageLimit == null || c.usedCount < c.usageLimit);
    send(res, available.map(toCouponDTO));
  });

  return router;
}
