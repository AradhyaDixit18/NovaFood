import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { UserDTO } from '@novafood/shared';
import { Nova } from '../../components/mascot/Nova';
import { Seo } from '../../components/Seo';
import { api, errorMessage } from '../../lib/api';
import { refreshSession } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { RestaurantForm } from './RestaurantForm';
import { useApplyRestaurant, useSelectedRestaurant } from './api';

export function PartnerApplyPage() {
  const apply = useApplyRestaurant();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const select = useSelectedRestaurant((s) => s.set);
  return (
    <div className="container-nf max-w-4xl py-8">
      <Seo title="Partner with NovaFood" description="List your restaurant on NovaFood and take live orders." path="/partner/apply" />
      <div className="mb-8 flex items-center gap-5">
        <Nova mood="happy" size={110} />
        <div>
          <h1 className="text-4xl font-extrabold">Partner with NovaFood</h1>
          <p className="mt-1 text-ink-soft">Tell us about your kitchen. Our team reviews every application before it goes live.</p>
        </div>
      </div>
      <RestaurantForm
        submitLabel="Submit application"
        busy={apply.isPending}
        onSubmit={(input) =>
          apply.mutate(input, {
            onSuccess: async (restaurant) => {
              // The role changed to partner: refresh the session so the new role is in the token.
              await refreshSession();
              const { user } = await api<{ user: UserDTO }>('/auth/me');
              useAuth.getState().setUser(user);
              select(restaurant._id);
              await qc.invalidateQueries({ queryKey: ['partner'] });
              toast.success('Application submitted 🎉', 'Set up your menu while we review it.');
              navigate('/partner/menu');
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </div>
  );
}
