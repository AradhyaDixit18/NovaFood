import { useState } from 'react';
import type { OrderDTO } from '@novafood/shared';
import { useCreateReview } from '../../api/orders';
import { errorMessage } from '../../lib/api';
import { useMascot } from '../../stores/mascot';
import { toast } from '../../stores/toast';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { StarInput, Textarea, VegMark } from '../../ui/primitives';

export function ReviewModal({ order, open, onClose }: { order: OrderDTO; open: boolean; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const uniqueDishes = [...new Map(order.lines.map((l) => [l.foodId, l])).values()];
  const [dishRatings, setDishRatings] = useState<Record<string, number>>({});
  const create = useCreateReview();

  const submit = () =>
    create.mutate(
      {
        orderId: order._id,
        rating,
        comment: comment.trim() || undefined,
        dishes: Object.entries(dishRatings).filter(([, r]) => r > 0).map(([foodId, r]) => ({ foodId, rating: r })),
      },
      {
        onSuccess: () => {
          useMascot.getState().react('happy');
          toast.success('Thanks for the review! ✍️');
          onClose();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`How was ${order.restaurant.name}?`}
      description="Your review is shown with your first name and last initial."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Later</Button>
          <Button onClick={submit} disabled={rating === 0} loading={create.isPending}>Post review</Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-2">
        <StarInput value={rating} onChange={setRating} label="Overall rating" />
        <p className="text-sm text-ink-faint">{['Tap to rate', 'Not great 😕', 'Could be better', 'Theek tha 👍', 'Bahut badhiya 😋', 'Full paisa vasool 🔥'][rating]}</p>
      </div>
      <Textarea className="mt-4" value={comment} maxLength={600} onChange={(e) => setComment(e.target.value)} placeholder="What should others order? Anything to improve?" aria-label="Review comment" />
      {uniqueDishes.length > 0 ? (
        <div className="mt-6 space-y-3">
          <p className="font-display font-bold">Rate the dishes (optional)</p>
          {uniqueDishes.map((l) => (
            <div key={l.foodId} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold"><VegMark veg={l.isVeg} /> {l.name}</span>
              <StarInput size="sm" value={dishRatings[l.foodId] ?? 0} onChange={(v) => setDishRatings((d) => ({ ...d, [l.foodId]: v }))} label={`Rating for ${l.name}`} />
            </div>
          ))}
        </div>
      ) : null}
    </Modal>
  );
}
