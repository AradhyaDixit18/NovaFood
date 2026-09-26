import type { OrderDTO, PaymentInitDTO } from '@novafood/shared';
import { useReportPaymentFailure, useVerifyPayment } from '../../api/orders';
import { errorMessage } from '../../lib/api';
import { payWithRazorpay } from '../../lib/razorpay';
import { useAuth } from '../../stores/auth';
import { useMascot } from '../../stores/mascot';
import { toast } from '../../stores/toast';

/** Runs the online payment sheet for an order and reports the outcome to the server. */
export function usePayForOrder() {
  const verify = useVerifyPayment();
  const failed = useReportPaymentFailure();

  return async (order: OrderDTO, payment: PaymentInitDTO, contact: string): Promise<'paid' | 'failed' | 'dismissed'> => {
    const user = useAuth.getState().user;
    try {
      const outcome = await payWithRazorpay(payment, { name: user?.name ?? '', email: user?.email ?? '', contact });
      if (outcome.status === 'success') {
        await verify.mutateAsync({ id: order._id, razorpayOrderId: outcome.razorpayOrderId, razorpayPaymentId: outcome.razorpayPaymentId, razorpaySignature: outcome.razorpaySignature });
        useMascot.getState().react('celebrate', 4000);
        toast.success('Payment successful ✅', 'Your order is on its way to the kitchen.');
        return 'paid';
      }
      if (outcome.status === 'failed') {
        await failed.mutateAsync({ id: order._id, reason: outcome.reason });
        useMascot.getState().react('worried', 3000);
        toast.error('Payment nahi hua 😭', `${outcome.reason}. No money is kept for failed payments. You can retry from the order page.`);
        return 'failed';
      }
      toast.info('Payment not completed', 'Your order is saved. Complete payment from the order page whenever you are ready.');
      return 'dismissed';
    } catch (err) {
      toast.error('Payment could not be completed', errorMessage(err));
      return 'failed';
    }
  };
}
