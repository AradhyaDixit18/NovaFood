import { useEffect, useState } from 'react';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Decides whether a 3D scene is worth rendering. Low-memory devices, data saver, reduced
 * motion or missing WebGL all get the lightweight SVG version instead.
 */
export function canRender3D(): boolean {
  if (typeof window === 'undefined' || prefersReducedMotion() || !hasWebGL()) return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
  return true;
}

/** True once the element has scrolled near the viewport (lazy mount heavy things). */
export function useInView<T extends Element>(ref: React.RefObject<T | null>, rootMargin = '200px'): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}
