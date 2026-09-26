import type { NotificationType } from '@novafood/shared';
import type { AppContext } from '../../context';
import { Notification } from '../../models/misc';
import { User } from '../../models/User';
import { toNotificationDTO } from '../../serializers';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  /** Transactional notices (payments, refunds, account) ignore opt-outs. */
  transactional?: boolean;
}

const PREF_FOR_TYPE: Partial<Record<NotificationType, 'orderUpdates' | 'offers' | 'recommendations'>> = {
  ORDER: 'orderUpdates',
  OFFER: 'offers',
  RESTAURANT: 'recommendations',
};

/** Stores an in-app notification (respecting preferences) and pushes it over the socket. */
export async function notify(ctx: AppContext, input: NotifyInput): Promise<void> {
  const pref = PREF_FOR_TYPE[input.type];
  if (pref && !input.transactional) {
    const user = await User.findById(input.userId).select('notificationPrefs').lean();
    if (user && user.notificationPrefs?.[pref] === false) return;
  }
  const doc = await Notification.create({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
  });
  ctx.realtime.toUser(input.userId, 'notification:new', toNotificationDTO(doc.toObject()));
}
