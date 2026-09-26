import { NavLink } from 'react-router';
import { Home, Package, Search, Smile, User } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuth } from '../../stores/auth';

/** Thumb-reachable navigation on phones; hidden from md up where the navbar has room. */
export function MobileTabBar() {
  const authed = useAuth((s) => s.status === 'authenticated');
  const tabs = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/search', label: 'Search', icon: Search },
    { to: '/moods', label: 'Moods', icon: Smile },
    { to: '/orders', label: 'Orders', icon: Package },
    { to: authed ? '/profile' : '/login', label: authed ? 'Profile' : 'Log in', icon: User },
  ];
  return (
    <nav aria-label="Mobile" className="glass fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={label}>
            <NavLink to={to} end={end} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', isActive ? 'text-brand' : 'text-ink-faint')}>
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
