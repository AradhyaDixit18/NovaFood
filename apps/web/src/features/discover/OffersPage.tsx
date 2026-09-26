import { COPY } from '@novafood/shared';
import { useCoupons } from '../../api/catalog';
import { CouponTicket } from '../../components/food/cards';
import { Seo } from '../../components/Seo';
import { EmptyState, PageLoader } from '../../components/States';

export function OffersPage() {
  const { data, isLoading } = useCoupons();
  return (
    <div className="container-nf py-8">
      <Seo title="Offers & coupons" description="Current NovaFood coupons and restaurant offers." path="/offers" />
      <h1 className="text-4xl font-extrabold">Offers 🏷️</h1>
      <p className="mt-1 text-ink-soft">Copy a code and apply it in your cart. Every rule is checked at checkout, so what you see is what you get.</p>
      {isLoading ? (
        <PageLoader />
      ) : !data?.length ? (
        <EmptyState title="No offers right now" body={COPY.empty.notifications.body} />
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {data.map((c) => <CouponTicket key={c._id} coupon={c} />)}
        </div>
      )}
    </div>
  );
}
