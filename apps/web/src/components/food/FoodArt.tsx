import { memo, type ReactNode } from 'react';
import type { Art } from '@novafood/shared';
import { cn } from '../../lib/cn';
import { optimizedImage } from '../../lib/image';

/**
 * Original sticker-style food illustrations drawn in SVG. They weigh almost nothing, never
 * break, and give every dish a consistent NovaFood look until a partner uploads a photo.
 */

const INK = '#1b0f3b';
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)} ${s}% ${l}%)`;

type Draw = (h: number) => ReactNode;

const bowl = (h: number, fill: ReactNode) => (
  <>
    {fill}
    <path d="M14 58 h92 c0 26 -20 44 -46 44 s-46 -18 -46 -44 z" fill={hsl(h, 80, 60)} {...S} />
    <path d="M24 70 c10 6 62 6 72 0" stroke={hsl(h, 90, 85)} strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M44 102 h32 l-4 8 h-24 z" fill={hsl(h, 70, 45)} {...S} />
  </>
);

const DRAWINGS: Record<string, Draw> = {
  burger: (h) => (
    <>
      <path d="M18 56 c0 -24 18 -38 42 -38 s42 14 42 38 z" fill="#f4a340" {...S} />
      {[34, 48, 62, 76, 86].map((x, i) => (
        <ellipse key={x} cx={x} cy={34 + (i % 2) * 8} rx="2.5" ry="1.6" fill="#fff4d6" />
      ))}
      <path d="M14 62 q 12 10 23 0 q 12 10 23 0 q 12 10 23 0 q 12 10 23 0 v4 h-92 z" fill="#5ccf59" {...S} />
      <rect x="16" y="66" width="88" height="14" rx="7" fill={hsl(h, 55, 32)} {...S} />
      <path d="M20 80 h80 l-6 8 h-68 z" fill="#ffd23c" {...S} />
      <path d="M18 88 h84 c0 12 -8 16 -18 16 h-48 c-10 0 -18 -4 -18 -16 z" fill="#f4a340" {...S} />
    </>
  ),
  pizza: (h) => (
    <>
      <path d="M60 104 L 16 26 Q 60 6 104 26 Z" fill="#ffcf5c" {...S} />
      <path d="M16 26 Q 60 6 104 26 L 98 36 Q 60 18 22 36 Z" fill="#e9973a" {...S} />
      {[
        [48, 46],
        [70, 44],
        [60, 64],
        [54, 82],
        [74, 62],
      ].map(([x = 0, y = 0]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="6.5" fill={hsl(h, 80, 48)} {...S} strokeWidth={2.5} />
      ))}
      <circle cx="40" cy="60" r="2.5" fill="#3a9d3a" />
      <circle cx="82" cy="50" r="2.5" fill="#3a9d3a" />
    </>
  ),
  biryani: (h) =>
    bowl(
      h,
      <>
        <path d="M18 58 c4 -26 24 -34 42 -34 s38 8 42 34 z" fill="#fff1c9" {...S} />
        {Array.from({ length: 12 }, (_, i) => (
          <ellipse key={i} cx={30 + (i % 6) * 12} cy={40 + Math.floor(i / 6) * 9} rx="3.5" ry="1.6" fill={i % 3 ? '#ffb347' : '#fff'} transform={`rotate(${i * 25} ${30 + (i % 6) * 12} ${40 + Math.floor(i / 6) * 9})`} />
        ))}
        <path d="M70 24 c10 -10 22 -8 26 -2 c-8 2 -16 6 -26 2z" fill="#3fbf5a" {...S} strokeWidth={2.5} />
      </>,
    ),
  curry: (h) =>
    bowl(
      h,
      <>
        <path d="M18 58 c4 -20 24 -26 42 -26 s38 6 42 26 z" fill={hsl(h, 85, 50)} {...S} />
        <path d="M36 46 c10 -8 22 6 34 -2 s16 4 16 4" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.8" />
        <circle cx="48" cy="40" r="3" fill="#3fbf5a" />
        <circle cx="74" cy="38" r="3" fill="#3fbf5a" />
      </>,
    ),
  bowl: (h) =>
    bowl(
      h,
      <>
        <path d="M18 58 c4 -22 24 -30 42 -30 s38 8 42 30 z" fill="#fff4dc" {...S} />
        <circle cx="46" cy="44" r="7" fill={hsl(h + 30, 80, 55)} {...S} strokeWidth={2.5} />
        <circle cx="70" cy="42" r="6" fill={hsl(h - 30, 70, 50)} {...S} strokeWidth={2.5} />
        <circle cx="60" cy="34" r="3" fill="#3fbf5a" />
      </>,
    ),
  salad: (h) =>
    bowl(
      h,
      <>
        {[26, 42, 58, 74, 88].map((x, i) => (
          <path key={x} d={`M${x} 58 c-6 -16 6 -30 ${12} -30 c4 12 0 24 -${6} 30z`} fill={i % 2 ? '#4fcf6a' : '#8fe06f'} {...S} strokeWidth={2.5} />
        ))}
        <circle cx="50" cy="44" r="6" fill="#ff5a4d" {...S} strokeWidth={2.5} />
        <circle cx="72" cy="46" r="5" fill="#ffd23c" {...S} strokeWidth={2.5} />
      </>,
    ),
  chaat: (h) =>
    bowl(
      h,
      <>
        <path d="M18 58 c4 -22 24 -30 42 -30 s38 8 42 30 z" fill="#ffe7a3" {...S} />
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={30 + (i % 5) * 14} cy={40 + Math.floor(i / 5) * 10} r="4" fill={['#fff', '#ff5a7a', '#3fbf5a'][i % 3]} {...S} strokeWidth={1.8} />
        ))}
      </>,
    ),
  pasta: (h) =>
    bowl(
      h,
      <>
        <path d="M18 58 c4 -20 24 -26 42 -26 s38 6 42 26 z" fill="#e9483a" {...S} />
        {[34, 50, 66, 82].map((x, i) => (
          <rect key={x} x={x - 7} y={36 + (i % 2) * 6} width="14" height="7" rx="3" fill="#ffd978" {...S} strokeWidth={2} transform={`rotate(${i * 30 - 30} ${x} ${40})`} />
        ))}
      </>,
    ),
  noodles: (h) => (
    <>
      <path d="M78 10 L 64 60 M 92 14 L 70 60" {...S} strokeWidth={5} stroke={INK} />
      {bowl(
        h,
        <>
          <path d="M20 58 c4 -18 22 -26 40 -26 s36 8 40 26 z" fill="#ffd978" {...S} />
          <path d="M28 52 c8 -12 16 12 24 0 s16 12 24 0 s12 10 18 2" stroke="#e8a93a" strokeWidth="3" fill="none" />
          <circle cx="44" cy="42" r="3" fill="#3fbf5a" />
          <rect x="68" y="38" width="10" height="6" rx="2" fill="#ff5a4d" />
        </>,
      )}
    </>
  ),
  ramen: (h) => (
    <>
      <path d="M80 8 L 66 58 M 94 12 L 72 58" {...S} strokeWidth={5} />
      {bowl(
        h,
        <>
          <path d="M18 58 c4 -18 24 -24 42 -24 s38 6 42 24 z" fill="#e0622e" {...S} />
          <ellipse cx="48" cy="46" rx="10" ry="8" fill="#fff" {...S} strokeWidth={2.5} />
          <circle cx="48" cy="46" r="4" fill="#ffb300" />
          <path d="M66 46 c6 -8 12 8 20 0" stroke="#ffd978" strokeWidth="4" fill="none" />
          <circle cx="80" cy="40" r="3" fill="#3fbf5a" />
        </>,
      )}
    </>
  ),
  dosa: (h) => (
    <>
      <ellipse cx="60" cy="96" rx="48" ry="10" fill={hsl(h, 60, 85)} {...S} />
      <path d="M12 86 L 100 40 C 110 36 116 44 110 52 L 22 96 C 14 100 6 92 12 86 Z" fill="#f2b44a" {...S} />
      <path d="M26 84 L 96 48" stroke="#c9832a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="28" cy="100" r="7" fill="#fff" {...S} strokeWidth={2.5} />
      <circle cx="44" cy="102" r="6" fill="#e8543b" {...S} strokeWidth={2.5} />
    </>
  ),
  paratha: () => (
    <>
      <ellipse cx="60" cy="72" rx="46" ry="30" fill="#f0c16a" {...S} />
      <ellipse cx="60" cy="64" rx="42" ry="24" fill="#f6d28a" {...S} />
      {[
        [42, 58],
        [66, 54],
        [56, 70],
        [78, 66],
      ].map(([x = 0, y = 0]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx="6" ry="3" fill="#c9832a" opacity="0.7" />
      ))}
      <rect x="66" y="40" width="16" height="10" rx="3" fill="#fff8d6" {...S} strokeWidth={2.5} />
    </>
  ),
  taco: (h) => (
    <>
      <path d="M12 88 C 12 46 108 46 108 88 Z" fill="#ffcf5c" {...S} />
      <path d="M22 74 q 8 -16 16 -4 q 8 -18 18 -4 q 10 -18 20 -2 q 8 -14 16 4" fill="#5ccf59" {...S} strokeWidth={2.5} />
      <circle cx="44" cy="66" r="5" fill={hsl(h, 80, 50)} {...S} strokeWidth={2} />
      <circle cx="72" cy="64" r="5" fill={hsl(h, 80, 50)} {...S} strokeWidth={2} />
      <path d="M12 88 C 12 60 108 60 108 88" fill="none" {...S} />
    </>
  ),
  burrito: (h) => (
    <>
      <rect x="20" y="26" width="80" height="72" rx="26" fill="#f7dfa4" {...S} transform="rotate(-20 60 62)" />
      <ellipse cx="80" cy="42" rx="20" ry="16" fill={hsl(h, 70, 55)} {...S} transform="rotate(-20 80 42)" />
      <circle cx="76" cy="42" r="4" fill="#5ccf59" />
      <circle cx="86" cy="46" r="4" fill="#fff" />
      <path d="M30 70 l 40 -14" stroke="#d8b061" strokeWidth="3" />
    </>
  ),
  momo: (h) => (
    <>
      <ellipse cx="60" cy="98" rx="50" ry="10" fill={hsl(h, 60, 80)} {...S} />
      {[
        [34, 74],
        [60, 64],
        [86, 74],
      ].map(([x = 0, y = 0]) => (
        <g key={`${x}`}>
          <path d={`M${x - 20} ${y + 18} c0 -20 10 -34 20 -34 s20 14 20 34 z`} fill="#fff8ee" {...S} />
          <path d={`M${x - 8} ${y - 4} q8 6 16 0 M${x - 12} ${y + 4} q12 8 24 0`} stroke="#d9c8b4" strokeWidth="2.5" fill="none" />
        </g>
      ))}
    </>
  ),
  idli: (h) => (
    <>
      <ellipse cx="60" cy="92" rx="50" ry="14" fill={hsl(h, 60, 80)} {...S} />
      <ellipse cx="42" cy="72" rx="24" ry="14" fill="#fffdf5" {...S} />
      <ellipse cx="76" cy="68" rx="24" ry="14" fill="#fffdf5" {...S} />
      <circle cx="96" cy="86" r="9" fill="#e8543b" {...S} strokeWidth={2.5} />
    </>
  ),
  samosa: () => (
    <>
      <path d="M16 96 L 44 36 L 72 96 Z" fill="#e9a441" {...S} />
      <path d="M50 96 L 78 30 L 106 96 Z" fill="#f2b44a" {...S} />
      <path d="M30 80 l 28 0 M 64 76 l 30 0" stroke="#c9832a" strokeWidth="3" />
    </>
  ),
  cake: (h) => (
    <>
      <path d="M20 58 L 96 40 L 100 96 L 20 96 Z" fill="#fff3e6" {...S} />
      <path d="M20 58 L 96 40 L 98 66 L 20 76 Z" fill={hsl(h, 70, 40)} {...S} />
      <path d="M20 84 L 99 78" stroke={hsl(h, 70, 40)} strokeWidth="6" />
      <path d="M20 58 L 96 40 C 90 50 84 44 76 52 C 68 60 60 50 50 58 C 40 64 30 56 20 58" fill={hsl(h, 70, 28)} {...S} />
      <circle cx="68" cy="34" r="8" fill="#e8243c" {...S} strokeWidth={2.5} />
      <path d="M68 26 q 4 -10 10 -12" stroke={INK} strokeWidth="3" fill="none" />
    </>
  ),
  dessert: (h) => (
    <>
      <path d="M28 44 h64 l-8 56 h-48 z" fill="#ffffffcc" {...S} />
      <path d="M31 64 h58 l-5 36 h-48 z" fill={hsl(h, 70, 70)} {...S} strokeWidth={2.5} />
      <path d="M26 44 c6 -16 62 -16 68 0 z" fill="#fff6e8" {...S} />
      <circle cx="60" cy="30" r="7" fill="#e8243c" {...S} strokeWidth={2.5} />
      <circle cx="46" cy="40" r="2.5" fill="#4fcf6a" />
      <circle cx="74" cy="40" r="2.5" fill="#4fcf6a" />
    </>
  ),
  icecream: (h) => (
    <>
      <path d="M36 58 L 60 110 L 84 58 Z" fill="#f2b44a" {...S} />
      <path d="M42 64 l 30 30 M 56 60 l 18 18 M 78 64 l -30 30" stroke="#c9832a" strokeWidth="2.5" />
      <circle cx="46" cy="50" r="17" fill={hsl(h, 70, 45)} {...S} />
      <circle cx="74" cy="50" r="17" fill={hsl(h + 40, 80, 75)} {...S} />
      <circle cx="60" cy="32" r="17" fill="#fff5e6" {...S} />
      <circle cx="60" cy="16" r="6" fill="#e8243c" {...S} strokeWidth={2.5} />
    </>
  ),
  drink: (h) => (
    <>
      <path d="M70 6 L 62 40" {...S} strokeWidth={6} stroke={hsl(h + 160, 80, 55)} />
      <path d="M30 36 h60 l-8 70 h-44 z" fill="#ffffffaa" {...S} />
      <path d="M33 56 h54 l-5 50 h-44 z" fill={hsl(h, 80, 58)} {...S} strokeWidth={2.5} />
      <circle cx="48" cy="72" r="5" fill="#ffffff99" />
      <circle cx="68" cy="84" r="4" fill="#ffffff99" />
      <path d="M86 40 c10 -2 12 12 2 14" fill="#ffe14d" {...S} strokeWidth={2.5} />
    </>
  ),
  shake: (h) => (
    <>
      <path d="M68 2 L 62 34" {...S} strokeWidth={6} stroke="#ff5a7a" />
      <path d="M32 40 h56 l-6 66 h-44 z" fill={hsl(h, 70, 72)} {...S} />
      <path d="M26 40 c4 -16 64 -16 68 0 c-4 6 -64 6 -68 0z" fill="#fff6ea" {...S} />
      <circle cx="60" cy="24" r="7" fill="#e8243c" {...S} strokeWidth={2.5} />
      <path d="M40 60 h40 M 38 76 h42" stroke="#ffffff88" strokeWidth="4" />
    </>
  ),
  coffee: (h) => (
    <>
      <path d="M44 30 c-4 -8 4 -12 0 -20 M 60 30 c-4 -8 4 -12 0 -20 M 76 30 c-4 -8 4 -12 0 -20" stroke={INK} strokeWidth="3" fill="none" opacity="0.4" strokeLinecap="round" />
      <path d="M28 40 h64 l-6 56 c-1 6 -6 10 -12 10 h-28 c-6 0 -11 -4 -12 -10 z" fill={hsl(h, 60, 92)} {...S} />
      <path d="M92 52 c16 0 16 26 -2 26" fill="none" {...S} strokeWidth={5} />
      <ellipse cx="60" cy="44" rx="30" ry="6" fill="#7a4a2a" {...S} strokeWidth={2.5} />
    </>
  ),
  chai: (h) => (
    <>
      <path d="M46 26 c-4 -8 4 -12 0 -20 M 64 26 c-4 -8 4 -12 0 -20" stroke={INK} strokeWidth="3" fill="none" opacity="0.4" strokeLinecap="round" />
      <path d="M34 38 h52 l-6 64 h-40 z" fill={hsl(h, 40, 90)} {...S} />
      <path d="M36 50 h48 l-5 52 h-38 z" fill="#c98a4a" {...S} strokeWidth={2.5} />
      <path d="M40 60 h40" stroke="#e6b27a" strokeWidth="4" />
    </>
  ),
  fries: () => (
    <>
      {[30, 42, 54, 66, 78, 90].map((x, i) => (
        <rect key={x} x={x - 5} y={14 + (i % 3) * 8} width="10" height="50" rx="3" fill="#ffd23c" {...S} strokeWidth={2.5} transform={`rotate(${(i - 3) * 6} ${x} 60)`} />
      ))}
      <path d="M22 50 h76 l-10 56 h-56 z" fill="#ff4d2e" {...S} />
      <path d="M44 72 c0 -8 32 -8 32 0 c0 10 -32 10 -32 0z" fill="#fff7f0" {...S} strokeWidth={2.5} />
    </>
  ),
  nachos: (h) => (
    <>
      <ellipse cx="60" cy="96" rx="50" ry="12" fill={hsl(h, 60, 80)} {...S} />
      {[
        [34, 70, 0],
        [60, 58, 20],
        [84, 72, -15],
        [48, 84, 40],
        [74, 86, -30],
      ].map(([x = 0, y = 0, r = 0]) => (
        <path key={`${x}${y}`} d={`M${x - 14} ${y + 12} L ${x} ${y - 14} L ${x + 14} ${y + 12} Z`} fill="#ffcf5c" {...S} strokeWidth={2.5} transform={`rotate(${r} ${x} ${y})`} />
      ))}
      <path d="M36 64 q 24 -14 48 0 q -10 10 -24 6 q -14 4 -24 -6z" fill="#ffb300" opacity="0.9" />
      <circle cx="52" cy="66" r="3" fill="#3fbf5a" />
      <circle cx="68" cy="64" r="3" fill="#e8243c" />
    </>
  ),
  churros: () => (
    <>
      {[40, 60, 80].map((x, i) => (
        <rect key={x} x={x - 7} y="18" width="14" height="76" rx="6" fill="#d98a3a" {...S} strokeWidth={2.5} transform={`rotate(${(i - 1) * 14} ${x} 94)`} />
      ))}
      <path d="M28 82 h64 l-6 24 h-52 z" fill="#6b3a1f" {...S} />
    </>
  ),
  corndog: () => (
    <>
      <path d="M60 110 V 76" stroke="#c9a06a" strokeWidth="7" strokeLinecap="round" />
      <rect x="40" y="10" width="40" height="72" rx="20" fill="#e9a441" {...S} />
      <path d="M46 30 q 14 8 28 0 M 46 46 q 14 8 28 0 M 46 62 q 14 8 28 0" stroke="#ff4d2e" strokeWidth="4" fill="none" strokeLinecap="round" />
    </>
  ),
  bread: () => (
    <>
      <path d="M20 58 c0 -20 16 -32 40 -32 s40 12 40 32 c0 6 -4 8 -8 8 v30 h-64 v-30 c-4 0 -8 -2 -8 -8 z" fill="#f2b44a" {...S} />
      <path d="M36 50 q 24 -14 48 0" stroke="#fff3c4" strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="30" y="72" width="60" height="10" rx="3" fill="#fff8d6" {...S} strokeWidth={2} />
    </>
  ),
  toast: (h) => (
    <>
      <path d="M22 50 c0 -18 12 -26 38 -26 s38 8 38 26 c0 4 -4 6 -6 6 v44 h-64 v-44 c-2 0 -6 -2 -6 -6 z" fill="#e0a256" {...S} />
      <path d="M32 58 h56 v36 h-56 z" fill="#f6d29a" />
      <ellipse cx="60" cy="72" rx="20" ry="14" fill={hsl(h, 50, 55)} {...S} strokeWidth={2.5} />
      <ellipse cx="60" cy="72" rx="7" ry="6" fill="#ffc21f" />
    </>
  ),
  kebab: (h) => (
    <>
      <path d="M10 100 L 108 22" stroke="#b08a5a" strokeWidth="5" strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={24 + i * 20} y={70 - i * 16} width="20" height="20" rx="6" fill={i % 2 ? hsl(h, 70, 35) : '#5ccf59'} {...S} strokeWidth={2.5} transform={`rotate(-38 ${34 + i * 20} ${80 - i * 16})`} />
      ))}
    </>
  ),
};

const ALIAS: Record<string, string> = {
  thali: 'curry',
  sandwich: 'bread',
  roll: 'dosa',
};

export const FOOD_ART_KINDS = Object.keys(DRAWINGS);

interface FoodArtProps {
  art: Art;
  imageUrl?: string | null;
  alt?: string;
  className?: string;
  /** Pixel width used to request a right-sized photo. */
  width?: number;
  rounded?: string;
}

export const FoodArt = memo(function FoodArt({ art, imageUrl, alt = '', className, width = 480, rounded = 'rounded-lg' }: FoodArtProps) {
  const hue = art.hue ?? 20;
  if (imageUrl) {
    return (
      <img
        src={optimizedImage(imageUrl, width)}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn('h-full w-full object-cover', rounded, className)}
      />
    );
  }
  const draw = DRAWINGS[art.kind] ?? DRAWINGS[ALIAS[art.kind] ?? ''] ?? DRAWINGS.bowl!;
  return (
    <div
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn('relative grid h-full w-full place-items-center overflow-hidden', rounded, className)}
      style={{ background: `radial-gradient(circle at 30% 25%, ${hsl(hue, 95, 88)}, ${hsl(hue + 25, 85, 72)} 70%)` }}
    >
      <svg viewBox="0 0 120 120" className="h-[78%] w-[78%] drop-shadow-[0_8px_10px_rgba(27,15,59,0.25)] transition-transform duration-500 ease-[var(--ease-spring)] group-hover:-rotate-6 group-hover:scale-110">
        {draw(hue)}
      </svg>
    </div>
  );
});
