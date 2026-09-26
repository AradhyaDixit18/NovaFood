import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { useReducedMotion } from '../../lib/device';
import { type MascotMood, useMascot } from '../../stores/mascot';

interface NovaProps {
  /** Overrides the global mascot mood (e.g. a fixed mood in an empty state). */
  mood?: MascotMood;
  size?: number;
  className?: string;
  /** Eyes follow the cursor. */
  track?: boolean;
  label?: string;
}

const BODY = '#ff6a3d';
const BODY_DARK = '#e5471f';

/**
 * Nova, NovaFood's mascot: a warm little bun with a star on its head. The SVG version is
 * used everywhere (empty states, toasts, loaders) and as the no-WebGL fallback for the 3D hero.
 */
export function Nova({ mood: override, size = 160, className, track = true, label }: NovaProps) {
  const globalMood = useMascot((s) => s.mood);
  const mood = override ?? globalMood;
  const reduced = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (!track || reduced) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        const dx = e.clientX - (box.left + box.width / 2);
        const dy = e.clientY - (box.top + box.height / 2);
        const dist = Math.hypot(dx, dy) || 1;
        const pull = Math.min(1, dist / 300);
        setLook({ x: (dx / dist) * 6 * pull, y: (dy / dist) * 5 * pull });
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [track, reduced]);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3800);
    return () => clearInterval(id);
  }, [reduced]);

  const eyesClosed = mood === 'sleepy' || blink;
  const happyEyes = mood === 'happy' || mood === 'celebrate';

  const bodyAnimation = reduced
    ? {}
    : mood === 'celebrate'
      ? { y: [0, -26, 0, -14, 0], rotate: [0, -8, 8, 0, 0], transition: { duration: 1.1, repeat: Infinity, repeatDelay: 0.4 } }
      : mood === 'happy'
        ? { y: [0, -12, 0], transition: { duration: 0.6, repeat: 2 } }
        : mood === 'worried'
          ? { x: [0, -3, 3, -3, 0], transition: { duration: 0.5, repeat: Infinity, repeatDelay: 1.2 } }
          : mood === 'hungry'
            ? { scale: [1, 1.04, 1], transition: { duration: 0.45, repeat: Infinity } }
            : { y: [0, -6, 0], transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const } };

  return (
    <motion.svg
      ref={ref}
      viewBox="0 0 200 210"
      width={size}
      height={size * 1.05}
      role="img"
      aria-label={label ?? `Nova the NovaFood mascot, feeling ${mood}`}
      className={cn('overflow-visible', className)}
      animate={bodyAnimation}
    >
      <defs>
        <radialGradient id="nova-body" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffb08a" />
          <stop offset="55%" stopColor={BODY} />
          <stop offset="100%" stopColor={BODY_DARK} />
        </radialGradient>
        <radialGradient id="nova-star" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff3a8" />
          <stop offset="100%" stopColor="#ffc93c" />
        </radialGradient>
      </defs>

      {/* shadow */}
      <ellipse cx="100" cy="200" rx="52" ry="7" fill="currentColor" opacity="0.12" />

      {/* antenna + star */}
      <path d="M100 52 C 98 40, 104 32, 102 24" stroke={BODY_DARK} strokeWidth="5" strokeLinecap="round" fill="none" />
      <motion.path
        d="M102 4 l5.3 10.8 11.9 1.7 -8.6 8.4 2 11.8 -10.6 -5.6 -10.6 5.6 2 -11.8 -8.6 -8.4 11.9 -1.7z"
        fill="url(#nova-star)"
        stroke="#e6a800"
        strokeWidth="1.5"
        style={{ originX: '102px', originY: '20px' }}
        animate={reduced ? {} : { rotate: mood === 'celebrate' ? 360 : [0, 12, -12, 0] }}
        transition={mood === 'celebrate' ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 4, repeat: Infinity }}
      />

      {/* arms */}
      <motion.path
        d={mood === 'celebrate' ? 'M42 120 C 22 100, 20 80, 28 66' : 'M40 130 C 26 136, 22 146, 28 154'}
        stroke={BODY_DARK}
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      <motion.path
        d={mood === 'celebrate' ? 'M158 120 C 178 100, 180 80, 172 66' : 'M160 130 C 174 136, 178 146, 172 154'}
        stroke={BODY_DARK}
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />

      {/* body */}
      <path d="M100 50 C 150 50, 172 90, 170 132 C 168 172, 140 192, 100 192 C 60 192, 32 172, 30 132 C 28 90, 50 50, 100 50 Z" fill="url(#nova-body)" />
      <ellipse cx="78" cy="78" rx="18" ry="9" fill="#fff" opacity="0.25" transform="rotate(-20 78 78)" />

      {/* cheeks */}
      <ellipse cx="58" cy="132" rx="11" ry="7" fill="#ff7ac6" opacity="0.55" />
      <ellipse cx="142" cy="132" rx="11" ry="7" fill="#ff7ac6" opacity="0.55" />

      {/* brows when worried */}
      {mood === 'worried' ? (
        <g stroke="#1b0f3b" strokeWidth="4" strokeLinecap="round">
          <path d="M62 86 L 84 92" />
          <path d="M138 86 L 116 92" />
        </g>
      ) : null}

      {/* eyes */}
      {happyEyes ? (
        <g stroke="#1b0f3b" strokeWidth="6" strokeLinecap="round" fill="none">
          <path d="M62 112 Q 74 98 86 112" />
          <path d="M114 112 Q 126 98 138 112" />
        </g>
      ) : eyesClosed ? (
        <g stroke="#1b0f3b" strokeWidth="5" strokeLinecap="round">
          <path d="M62 110 Q 74 118 86 110" fill="none" />
          <path d="M114 110 Q 126 118 138 110" fill="none" />
        </g>
      ) : (
        <g>
          <ellipse cx="74" cy="108" rx="15" ry="17" fill="#fff" />
          <ellipse cx="126" cy="108" rx="15" ry="17" fill="#fff" />
          <circle cx={74 + look.x} cy={110 + look.y + (mood === 'worried' ? -4 : 0)} r="8" fill="#1b0f3b" />
          <circle cx={126 + look.x} cy={110 + look.y + (mood === 'worried' ? -4 : 0)} r="8" fill="#1b0f3b" />
          <circle cx={77 + look.x} cy={106 + look.y} r="2.6" fill="#fff" />
          <circle cx={129 + look.x} cy={106 + look.y} r="2.6" fill="#fff" />
        </g>
      )}

      {/* mouth */}
      {mood === 'hungry' ? (
        <g>
          <ellipse cx="100" cy="150" rx="15" ry="13" fill="#1b0f3b" />
          <ellipse cx="100" cy="157" rx="8" ry="4" fill="#ff7ac6" />
          <path d="M118 150 q 3 10 0 14" stroke="#7fd3ff" strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      ) : mood === 'worried' ? (
        <path d="M84 154 q 8 -6 16 0 t 16 0" stroke="#1b0f3b" strokeWidth="5" strokeLinecap="round" fill="none" />
      ) : mood === 'sleepy' ? (
        <ellipse cx="100" cy="152" rx="6" ry="4" fill="#1b0f3b" />
      ) : (
        <path d={happyEyes ? 'M80 142 Q 100 170 120 142 Z' : 'M84 146 Q 100 160 116 146'} stroke="#1b0f3b" strokeWidth="5" strokeLinecap="round" fill={happyEyes ? '#1b0f3b' : 'none'} />
      )}

      {/* extras */}
      {mood === 'worried' ? <path d="M156 84 q 6 10 0 14 q -6 -4 0 -14z" fill="#7fd3ff" /> : null}
      {mood === 'sleepy' ? (
        <text x="150" y="60" fontFamily="var(--font-display)" fontWeight="800" fontSize="22" fill="currentColor" opacity="0.6">
          z z
        </text>
      ) : null}
      {mood === 'celebrate' && !reduced ? (
        <g>
          {[
            ['#c6f432', 20, 40],
            ['#ff7ac6', 180, 36],
            ['#6c2bd9', 12, 100],
            ['#ffc93c', 190, 104],
            ['#2ec4a0', 40, 14],
            ['#ff4d2e', 160, 12],
          ].map(([color, x, y], i) => (
            <motion.rect
              key={i}
              x={x as number}
              y={y as number}
              width="8"
              height="8"
              rx="2"
              fill={color as string}
              animate={{ y: [0, -14, 6], rotate: [0, 180, 360], opacity: [0, 1, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </g>
      ) : null}
    </motion.svg>
  );
}
