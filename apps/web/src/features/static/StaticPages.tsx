import type { ReactNode } from 'react';
import { Nova } from '../../components/mascot/Nova';
import { Seo } from '../../components/Seo';
import { EmptyState } from '../../components/States';
import { ButtonLink } from '../../ui/Button';

function Prose({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="container-nf max-w-3xl py-10">
      <h1 className="mb-6 text-4xl font-extrabold">{title}</h1>
      <div className="space-y-4 text-ink-soft [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink">{children}</div>
    </div>
  );
}

export function AboutPage() {
  return (
    <>
      <Seo title="About NovaFood" description="What NovaFood is and how it works." path="/about" />
      <Prose title="About NovaFood">
        <div className="flex justify-center"><Nova mood="happy" size={140} /></div>
        <p>
          NovaFood is a full-stack food ordering platform built as a portfolio project by Aradhya Dixit. It pairs a playful, Gen-Z
          experience (mood-based discovery, Nova the mascot, Hinglish microcopy) with production-style engineering: server-side
          pricing, an enforced order state machine, verified online payments, and real-time tracking over WebSockets.
        </p>
        <h2>Demo data</h2>
        <p>The restaurants, dishes, reviews and past orders in the demo are fictional and exist only so the app can be explored.</p>
        <h2>How tracking works</h2>
        <p>
          Every status you see comes from the restaurant or the payment gateway in real time. NovaFood does not yet have a rider
          app, so the delivery progress bar follows the order’s stage rather than a GPS location.
        </p>
        <h2>Support</h2>
        <p>Questions about an order? Write to support@novafood.dev with your order number.</p>
      </Prose>
    </>
  );
}

export function PrivacyPage() {
  return (
    <>
      <Seo title="Privacy" path="/privacy" />
      <Prose title="Privacy">
        <p>We store what we need to deliver your food: your name, email, phone, delivery addresses and order history.</p>
        <h2>Passwords & sessions</h2>
        <p>Passwords are hashed with bcrypt. Sessions use short-lived access tokens and a rotating refresh token kept in an httpOnly cookie.</p>
        <h2>Payments</h2>
        <p>Online payments are processed by Razorpay. NovaFood never sees or stores your card or UPI details.</p>
        <h2>Personalisation</h2>
        <p>Recommendations use your own orders and favourites. You can turn this off in Profile → Privacy, and download all your data there.</p>
        <h2>Reviews</h2>
        <p>Reviews show your first name and last initial only.</p>
      </Prose>
    </>
  );
}

export function TermsPage() {
  return (
    <>
      <Seo title="Terms" path="/terms" />
      <Prose title="Terms of use">
        <p>NovaFood is a demonstration project. Orders placed on the demo are not fulfilled by real restaurants.</p>
        <h2>Orders & cancellation</h2>
        <p>You can cancel an order until the restaurant accepts it. Paid orders that are cancelled or rejected are refunded to the original payment method.</p>
        <h2>Coupons & Nova Points</h2>
        <p>Coupons and points are validated when you place the order. Points have no cash value outside NovaFood.</p>
      </Prose>
    </>
  );
}

export function NotFoundPage() {
  return (
    <div className="container-nf">
      <Seo title="Page not found" noindex />
      <EmptyState mood="worried" title="Ye page kho gaya 🫠" body="The link may be old, or the page moved." action={<ButtonLink to="/">Take me home</ButtonLink>} />
    </div>
  );
}
