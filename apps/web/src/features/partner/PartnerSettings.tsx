import { PageLoader } from '../../components/States';
import { errorMessage } from '../../lib/api';
import { toast } from '../../stores/toast';
import { RestaurantForm } from './RestaurantForm';
import { usePartnerRestaurant, useSelectedRestaurant, useUpdateRestaurant } from './api';

export function PartnerSettings() {
  const id = useSelectedRestaurant((s) => s.id);
  const { data, isLoading } = usePartnerRestaurant(id);
  const update = useUpdateRestaurant(id);
  if (isLoading || !data) return <PageLoader />;
  return (
    <RestaurantForm
      key={data.restaurant._id}
      initial={data.restaurant}
      submitLabel="Save changes"
      busy={update.isPending}
      onSubmit={(input) => update.mutate(input, { onSuccess: () => toast.success('Restaurant updated ✅'), onError: (err) => toast.error(errorMessage(err)) })}
    />
  );
}
