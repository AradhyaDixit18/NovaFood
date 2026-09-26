import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Clock, Search, Store, TrendingUp, UtensilsCrossed, X } from 'lucide-react';
import { useSuggest, useTrending } from '../api/catalog';
import { clearRecentSearches, getRecentSearches, rememberSearch, useDebounced } from '../hooks/misc';
import { cn } from '../lib/cn';
import { money } from '../lib/format';
import { VegMark } from '../ui/primitives';

const PLACEHOLDERS = ['biryani 🍛', 'momos 🥟', 'masala dosa', 'pizza for the squad 🍕', 'something spicy 🔥', 'late-night chai ☕'];

type Option = { id: string; label: string; hint?: string; icon: 'recent' | 'trending' | 'restaurant' | 'dish' | 'cuisine' | 'search'; href: string; veg?: boolean };

export function SearchBox({ autoFocus, className, size = 'md' }: { autoFocus?: boolean; className?: string; size?: 'md' | 'lg' }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [placeholder, setPlaceholder] = useState(0);
  const [recentVersion, setRecentVersion] = useState(0);
  const navigate = useNavigate();
  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const q = useDebounced(value.trim(), 200);
  const suggest = useSuggest(q);
  const trending = useTrending();

  useEffect(() => {
    const id = setInterval(() => setPlaceholder((p) => (p + 1) % PLACEHOLDERS.length), 2600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const options: Option[] = useMemo(() => {
    if (q.length < 2) {
      const recent = getRecentSearches().map((t) => ({ id: `r-${t}`, label: t, icon: 'recent' as const, href: `/search?q=${encodeURIComponent(t)}` }));
      const hot = (trending.data ?? []).slice(0, 5).map((t) => ({ id: `t-${t.term}`, label: t.term, icon: 'trending' as const, href: `/search?q=${encodeURIComponent(t.term)}` }));
      return [...recent, ...hot];
    }
    const data = suggest.data;
    return [
      { id: 'search', label: `Search “${q}”`, icon: 'search' as const, href: `/search?q=${encodeURIComponent(q)}` },
      ...(data?.restaurants ?? []).map((r) => ({ id: `rs-${r._id}`, label: r.name, hint: r.cuisines.slice(0, 2).join(' · '), icon: 'restaurant' as const, href: `/r/${r.slug}` })),
      ...(data?.dishes ?? []).map((d) => ({ id: `d-${d._id}`, label: d.name, hint: money(d.pricePaise), icon: 'dish' as const, href: `/dish/${d._id}`, veg: d.isVeg })),
      ...(data?.cuisines ?? []).map((c) => ({ id: `c-${c}`, label: c, hint: 'Cuisine', icon: 'cuisine' as const, href: `/restaurants?cuisine=${encodeURIComponent(c)}` })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recentVersion re-reads localStorage
  }, [q, suggest.data, trending.data, recentVersion]);

  const go = (option?: Option) => {
    const target = option ?? (value.trim() ? { href: `/search?q=${encodeURIComponent(value.trim())}`, label: value.trim(), icon: 'search' as const, id: 'x' } : null);
    if (!target) return;
    if (target.icon === 'search' || target.icon === 'recent' || target.icon === 'trending') rememberSearch(target.icon === 'search' ? value.trim() : target.label);
    setOpen(false);
    setActive(-1);
    navigate(target.href);
  };

  const Icon = ({ kind }: { kind: Option['icon'] }) => {
    const cls = 'h-4 w-4 shrink-0 text-ink-faint';
    if (kind === 'recent') return <Clock className={cls} />;
    if (kind === 'trending') return <TrendingUp className={cn(cls, 'text-brand')} />;
    if (kind === 'restaurant') return <Store className={cls} />;
    if (kind === 'dish') return <UtensilsCrossed className={cls} />;
    return <Search className={cls} />;
  };

  return (
    <div ref={wrapper} className={cn('relative', className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(active >= 0 ? options[active] : undefined);
        }}
      >
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search restaurants and dishes
        </label>
        <div className={cn('flex items-center gap-2 rounded-full border-2 border-line bg-surface px-4 transition-colors focus-within:border-grape', size === 'lg' ? 'h-14' : 'h-11')}>
          <Search aria-hidden className="h-5 w-5 text-ink-faint" />
          <input
            id={`${listId}-input`}
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoFocus={autoFocus}
            autoComplete="off"
            value={value}
            placeholder={`Try "${PLACEHOLDERS[placeholder]}"`}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(options.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(-1, a - 1));
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            className="h-full w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
          />
          {value ? (
            <button type="button" aria-label="Clear search" onClick={() => setValue('')} className="rounded-full p-1 text-ink-faint hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </form>

      {open && options.length > 0 ? (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-lift">
          {q.length < 2 && getRecentSearches().length > 0 ? (
            <li className="flex items-center justify-between px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-wider text-ink-faint">
              Recent
              <button
                type="button"
                className="normal-case tracking-normal text-brand hover:underline"
                onClick={() => {
                  clearRecentSearches();
                  setRecentVersion((v) => v + 1);
                }}
              >
                Clear
              </button>
            </li>
          ) : null}
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={active === i}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(o);
              }}
              className={cn('flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5', active === i && 'bg-surface-2')}
            >
              <Icon kind={o.icon} />
              {o.veg !== undefined ? <VegMark veg={o.veg} /> : null}
              <span className="flex-1 truncate font-medium">{o.label}</span>
              {o.hint ? <span className="text-xs text-ink-faint">{o.hint}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
