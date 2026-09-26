import { motion } from 'motion/react';
import { Flame, Lock, Sparkles } from 'lucide-react';
import { useRewards } from '../../api/account';
import { Nova } from '../../components/mascot/Nova';
import { Seo } from '../../components/Seo';
import { PageLoader } from '../../components/States';
import { cn } from '../../lib/cn';
import { money, shortDate } from '../../lib/format';
import { useAuth } from '../../stores/auth';
import { Card } from '../../ui/primitives';
import { ShareCardButton } from '../orders/ShareCard';

export function RewardsPage() {
  const { data, isLoading } = useRewards();
  const user = useAuth((s) => s.user);
  if (isLoading || !data) return <PageLoader />;
  const unlocked = data.achievements.filter((a) => a.unlocked);

  return (
    <div className="container-nf py-8">
      <Seo title="Nova Points & achievements" noindex />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand via-bubble to-grape p-8 text-white shadow-lift">
          <div aria-hidden className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-lime/30 blur-2xl" />
          <p className="font-semibold text-white/80">Nova Points balance</p>
          <p className="mt-2 font-display text-7xl font-extrabold">{data.balance}</p>
          <p className="mt-1 font-semibold">Worth {money(data.balance * data.pointValuePaise)} at checkout</p>
          <ul className="mt-6 space-y-1 text-sm text-white/85">
            <li>• {data.earnRule}</li>
            <li>• {data.redeemRule}</li>
          </ul>
        </div>
        <Card className="flex items-center gap-5 p-6">
          <Nova mood={data.stats.weeklyStreak >= 2 ? 'celebrate' : 'happy'} size={110} />
          <div>
            <p className="flex items-center gap-2 font-display text-2xl font-extrabold"><Flame className="h-6 w-6 text-brand" /> {data.stats.weeklyStreak}-week streak</p>
            <p className="mt-1 text-sm text-ink-soft">Weeks in a row with at least one delivered order. No pressure: streaks never cost you anything.</p>
            <p className="mt-3 text-sm font-semibold">
              {data.stats.distinctCuisines} cuisines · {data.stats.distinctRestaurants} kitchens · {data.stats.deliveredOrders} orders
            </p>
          </div>
        </Card>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-extrabold">Achievements</h2>
          {unlocked.length ? (
            <ShareCardButton
              label="Share my badges"
              content={{ eyebrow: 'Food explorer 🧭', title: `${unlocked.length} NovaFood badges`, lines: unlocked.map((a) => `${a.emoji} ${a.title}`), footer: user?.privacy.showNameOnShareCards ? `${user.name.split(' ')[0]} on NovaFood` : 'on NovaFood', hue: 280 }}
            />
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.achievements.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={cn('flex h-full gap-4 p-5', !a.unlocked && 'opacity-80')}>
                <span className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-full text-3xl', a.unlocked ? 'bg-lime' : 'bg-surface-2 grayscale')}>{a.unlocked ? a.emoji : <Lock className="h-6 w-6 text-ink-faint" />}</span>
                <div className="flex-1">
                  <p className="font-display font-bold">{a.title}</p>
                  <p className="text-sm text-ink-soft">{a.description}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={a.target} aria-valuenow={a.progress} aria-label={`${a.title} progress`}>
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(a.progress / a.target) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">{a.progress}/{a.target}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-2xl font-extrabold">Points history</h2>
        {data.history.length === 0 ? (
          <p className="text-ink-soft">Earn your first points on your next delivered order <Sparkles className="inline h-4 w-4 text-brand" /></p>
        ) : (
          <Card className="divide-y divide-line">
            {data.history.map((h) => (
              <div key={h._id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-semibold">{h.description}</p>
                  <p className="text-xs text-ink-faint">{shortDate(h.createdAt)}</p>
                </div>
                <span className={cn('font-display text-lg font-bold', h.points > 0 ? 'text-success' : 'text-danger')}>{h.points > 0 ? `+${h.points}` : h.points}</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
