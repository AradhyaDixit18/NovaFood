import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Bell, ChefHat, Heart, LogOut, Moon, Package, Shield, ShoppingBag, Sparkles, Sun, User } from 'lucide-react';
import { useUnreadCount } from '../../api/account';
import { useLogout } from '../../api/auth';
import { useCartCount } from '../../api/cart';
import { cn } from '../../lib/cn';
import { useAuth } from '../../stores/auth';
import { useUi } from '../../stores/ui';
import { ButtonLink } from '../../ui/Button';
import { SearchBox } from '../SearchBox';
import { Logo } from './Logo';

function CartButton() {
  const count = useCartCount();
  const ref = useRef<HTMLAnchorElement>(null);
  const setTarget = useUi((s) => s.setCartTarget);
  useEffect(() => {
    const update = () => ref.current && setTarget(ref.current.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, [setTarget]);
  return (
    <Link ref={ref} to="/cart" data-cart-target className="relative grid h-11 w-11 place-items-center rounded-full bg-ink text-canvas transition-transform hover:-translate-y-0.5" aria-label={`Cart, ${count} items`}>
      <ShoppingBag className="h-5 w-5" />
      {count > 0 ? (
        <motion.span
          key={count}
          initial={{ scale: 0.4 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 600, damping: 15 }}
          className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-canvas bg-brand px-1 text-[11px] font-bold text-white"
        >
          {count}
        </motion.span>
      ) : null}
    </Link>
  );
}

function ProfileMenu() {
  const user = useAuth((s) => s.user)!;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const items = [
    { to: '/profile', label: 'Profile', icon: User },
    { to: '/orders', label: 'Orders', icon: Package },
    { to: '/favorites', label: 'Favourites', icon: Heart },
    { to: '/rewards', label: 'Nova Points', icon: Sparkles },
    ...(user.role === 'partner' || user.role === 'admin' ? [{ to: '/partner', label: 'Partner portal', icon: ChefHat }] : []),
    ...(user.role === 'admin' ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-2 rounded-full border-2 border-line bg-surface pl-1 pr-3 font-semibold hover:border-ink"
      >
        <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-grape font-display text-sm font-bold text-white">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="max-w-24 truncate text-sm">{user.name.split(' ')[0]}</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-60 rounded-lg border border-line bg-surface p-2 shadow-lift">
          <div className="px-3 py-2">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs text-ink-faint">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          {items.map(({ to, label, icon: Icon }) => (
            <Link key={to} role="menuitem" to={to} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-2">
              <Icon className="h-4 w-4 text-ink-faint" /> {label}
            </Link>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            role="menuitem"
            type="button"
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/') })}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-danger hover:bg-surface-2"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Navbar() {
  const status = useAuth((s) => s.status);
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const unread = useUnreadCount();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const link = ({ isActive }: { isActive: boolean }) =>
    cn('rounded-full px-3 py-2 text-sm font-semibold transition-colors', isActive ? 'bg-ink text-canvas' : 'text-ink-soft hover:text-ink');

  return (
    <header className={cn('sticky top-0 z-40 transition-all duration-300', scrolled ? 'glass shadow-soft' : 'bg-transparent')}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas">
        Skip to content
      </a>
      <div className="container-nf flex h-16 items-center gap-3 md:h-20 md:gap-5">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          <NavLink to="/restaurants" className={link}>
            Explore
          </NavLink>
          <NavLink to="/moods" className={link}>
            Moods
          </NavLink>
          <NavLink to="/offers" className={link}>
            Offers
          </NavLink>
        </nav>
        <div className="hidden flex-1 md:block">{location.pathname !== '/search' ? <SearchBox /> : null}</div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} className="grid h-11 w-11 place-items-center rounded-full text-ink-soft hover:bg-surface-2 hover:text-ink">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          {status === 'authenticated' ? (
            <Link to="/notifications" aria-label={`Notifications, ${unread.data?.unread ?? 0} unread`} className="relative hidden h-11 w-11 place-items-center rounded-full text-ink-soft hover:bg-surface-2 hover:text-ink sm:grid">
              <Bell className="h-5 w-5" />
              {unread.data?.unread ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-brand" /> : null}
            </Link>
          ) : null}
          <CartButton />
          {status === 'authenticated' ? (
            <div className="hidden sm:block">
              <ProfileMenu />
            </div>
          ) : status === 'anonymous' ? (
            <ButtonLink to="/login" state={{ from: location.pathname }} variant="outline" size="md" className="hidden sm:inline-flex">
              Log in
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </header>
  );
}
