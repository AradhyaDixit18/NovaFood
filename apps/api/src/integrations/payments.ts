import { createHmac } from 'node:crypto';
import Razorpay from 'razorpay';
import { safeEqual } from '../lib/tokens';

export interface ProviderOrder {
  providerOrderId: string;
  amountPaise: number;
  currency: 'INR';
}

/**
 * Payment gateway boundary. Orders are only ever marked paid after `verifyCheckoutSignature`
 * or a webhook that passes `verifyWebhookSignature`, never on the client's word.
 */
export interface PaymentProvider {
  readonly name: 'razorpay';
  readonly keyId: string;
  createOrder(input: { amountPaise: number; receipt: string; notes?: Record<string, string> }): Promise<ProviderOrder>;
  verifyCheckoutSignature(input: { providerOrderId: string; providerPaymentId: string; signature: string }): boolean;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  refund(providerPaymentId: string, amountPaise: number): Promise<{ refundId: string }>;
}

export function hmacHex(secret: string, payload: string | Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;
  private readonly client: Razorpay;

  constructor(
    readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string | undefined,
  ) {
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async createOrder(input: { amountPaise: number; receipt: string; notes?: Record<string, string> }): Promise<ProviderOrder> {
    const order = await this.client.orders.create({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt,
      notes: input.notes,
    });
    return { providerOrderId: order.id, amountPaise: Number(order.amount), currency: 'INR' };
  }

  verifyCheckoutSignature(input: { providerOrderId: string; providerPaymentId: string; signature: string }): boolean {
    const expected = hmacHex(this.keySecret, `${input.providerOrderId}|${input.providerPaymentId}`);
    return safeEqual(expected, input.signature);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret) return false;
    return safeEqual(hmacHex(this.webhookSecret, rawBody), signature);
  }

  async refund(providerPaymentId: string, amountPaise: number): Promise<{ refundId: string }> {
    const refund = await this.client.payments.refund(providerPaymentId, { amount: amountPaise });
    return { refundId: refund.id };
  }
}
