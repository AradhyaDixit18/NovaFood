import type { PaymentInitDTO } from '@novafood/shared';

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (resp: { error: { description?: string; reason?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

/** Loads Razorpay Checkout only when someone actually pays online. */
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error('Could not load the payment window. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return loading;
}

export type PaymentOutcome =
  | { status: 'success'; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
  | { status: 'failed'; reason: string }
  | { status: 'dismissed' };

/**
 * Opens the payment sheet. The result is only a *claim* from the browser; the server
 * verifies the signature (and the webhook) before the order is treated as paid.
 */
export async function payWithRazorpay(init: PaymentInitDTO, customer: { name: string; email: string; contact: string }): Promise<PaymentOutcome> {
  await loadCheckout();
  return new Promise((resolve) => {
    let settled = false;
    const done = (outcome: PaymentOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    const rzp = new window.Razorpay!({
      key: init.keyId,
      amount: init.amountPaise,
      currency: init.currency,
      order_id: init.providerOrderId,
      name: 'NovaFood',
      description: 'Food order',
      prefill: customer,
      theme: { color: '#ff4d2e' },
      handler: (resp: RazorpaySuccess) =>
        done({ status: 'success', razorpayOrderId: resp.razorpay_order_id, razorpayPaymentId: resp.razorpay_payment_id, razorpaySignature: resp.razorpay_signature }),
      modal: { ondismiss: () => done({ status: 'dismissed' }) },
    });
    rzp.on('payment.failed', (resp) => done({ status: 'failed', reason: resp.error.description ?? resp.error.reason ?? 'Payment failed' }));
    rzp.open();
  });
}
