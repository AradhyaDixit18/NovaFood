import { Link } from 'react-router';
import { COPY } from '@novafood/shared';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface pb-24 pt-12 md:pb-12">
      <div className="container-nf grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-ink-soft">
            {COPY.tagline} Discover food by mood, order in a few taps and watch it arrive live.
          </p>
          <p className="mt-4 inline-block rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-soft">
            Portfolio project · restaurants and reviews in the demo are fictional
          </p>
        </div>
        <nav aria-label="Explore">
          <h2 className="mb-3 font-display font-bold">Explore</h2>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li><Link className="hover:text-ink" to="/restaurants">All restaurants</Link></li>
            <li><Link className="hover:text-ink" to="/moods">Food by mood</Link></li>
            <li><Link className="hover:text-ink" to="/offers">Offers</Link></li>
            <li><Link className="hover:text-ink" to="/rewards">Nova Points</Link></li>
          </ul>
        </nav>
        <nav aria-label="Company">
          <h2 className="mb-3 font-display font-bold">NovaFood</h2>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li><Link className="hover:text-ink" to="/about">About</Link></li>
            <li><Link className="hover:text-ink" to="/partner/apply">Partner with us</Link></li>
            <li><Link className="hover:text-ink" to="/privacy">Privacy</Link></li>
            <li><Link className="hover:text-ink" to="/terms">Terms</Link></li>
          </ul>
        </nav>
      </div>
      <p className="container-nf mt-10 text-xs text-ink-faint">© {new Date().getFullYear()} NovaFood. Pet happy, life happy.</p>
    </footer>
  );
}
