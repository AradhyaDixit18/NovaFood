import { useEffect, useState } from 'react';
import { safeStorage } from '../lib/storage';

export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

const RECENT_KEY = 'nf-recent-searches';

export function getRecentSearches(): string[] {
  return safeStorage.get<string[]>(RECENT_KEY, []);
}

export function rememberSearch(term: string): void {
  const t = term.trim();
  if (!t) return;
  safeStorage.set(RECENT_KEY, [t, ...getRecentSearches().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6));
}

export function clearRecentSearches(): void {
  safeStorage.remove(RECENT_KEY);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
