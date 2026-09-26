import { Router } from 'express';
import { idParams, paginationQuery } from '@novafood/shared';
import type { AppContext } from '../../context';
import { notFound } from '../../lib/errors';
import { pageMeta, parse, send } from '../../lib/http';
import { authenticate, currentUser } from '../../middleware/auth';
import { Notification } from '../../models/misc';
import { toNotificationDTO } from '../../serializers';

export function createNotificationsRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(authenticate(ctx, { required: true }));

  router.get('/', async (req, res) => {
    const q = parse(paginationQuery, req.query);
    const userId = currentUser(req).id;
    const [rows, total, unread] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, readAt: null }),
    ]);
    res.json({ data: rows.map(toNotificationDTO), meta: { ...pageMeta(q.page, q.limit, total), unread } });
  });

  router.get('/unread-count', async (req, res) => {
    send(res, { unread: await Notification.countDocuments({ userId: currentUser(req).id, readAt: null }) });
  });

  router.post('/:id/read', async (req, res) => {
    const { id } = parse(idParams, req.params);
    const doc = await Notification.findOneAndUpdate(
      { _id: id, userId: currentUser(req).id },
      { $set: { readAt: ctx.now() } },
      { new: true },
    ).lean();
    if (!doc) throw notFound('Notification');
    send(res, toNotificationDTO(doc));
  });

  router.post('/read-all', async (req, res) => {
    const result = await Notification.updateMany({ userId: currentUser(req).id, readAt: null }, { $set: { readAt: ctx.now() } });
    send(res, { updated: result.modifiedCount });
  });

  return router;
}
