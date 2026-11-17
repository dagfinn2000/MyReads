import { STICKERS, stickerOf, stickerTilt, type StickerKey } from "@/lib/stickers";
import { cn } from "@/lib/utils";

/**
 * The art for the stickers and stamps a reader pins on a cover
 * (lib/stickers.ts), and the layer that shows them on one.
 *
 * Each one is drawn once per page as a <symbol> in StickerSprite (the app
 * layout renders it, hidden but not display:none, so its gradients work),
 * and each sticker on a cover is a small <svg> using it. Stickers are
 * die-cut, with a white edge and a soft shadow (globals.css, "Stickers");
 * the Re-read one is a rubber stamp inked on a round paper label.
 * Words are in the app's book face (Literata) or its sans, in capitals,
 * big enough to read on a book page's cover; on the library's smaller
 * covers the shape and colour carry them.
 */

/** Points round a circle at radius r, every `step` of a turn, starting at
 *  the top: for serrated seals, starbursts and sun rays. */
function star(cx: number, cy: number, points: number, outer: number, inner: number): string {
  const d: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    d.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${d.join("L")}Z`;
}

/** Laurel leaves along an arc of radius r from angle `from` to `to`
 *  (degrees, 0 = right, clockwise), each a small ellipse along the arc. */
function laurel(r: number, from: number, to: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const deg = from + ((to - from) * (i + 0.5)) / count;
    const a = (deg * Math.PI) / 180;
    const x = 50 + r * Math.cos(a);
    const y = 50 + r * Math.sin(a);
    // Leaves lean along the arc and a little outward.
    const lean = deg + (to > from ? 90 : -90) + (to > from ? -25 : 25);
    return (
      <ellipse
        key={i}
        cx={x.toFixed(1)}
        cy={y.toFixed(1)}
        rx="4.4"
        ry="1.9"
        transform={`rotate(${lean.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})`}
      />
    );
  });
}

const SEAL = star(50, 50, 30, 47, 43.5);
const SEAL_EDGE = star(50, 50, 30, 49.5, 46);
const BURST = star(50, 50, 16, 47, 39);
const BURST_EDGE = star(50, 50, 16, 49.5, 41.5);
const RAYS = star(50, 50, 14, 47, 36);
const RAYS_EDGE = star(50, 50, 14, 49.5, 38.5);
const HEART =
  "M50 87C23 68 5 51 5 31C5 15 17 5 30 5C40 5 47 11 50 18C53 11 60 5 70 5C83 5 95 15 95 31C95 51 77 68 50 87Z";
const TAG = "M22 5H93a3 3 0 0 1 3 3V52a3 3 0 0 1-3 3H22L5 30Z";

const SERIF = "var(--font-literata), Georgia, serif";
const SANS = "var(--font-sans), system-ui, sans-serif";

/** Width over height of each sticker's picture. */
const RATIO: Record<StickerKey, number> = {
  signed: 1,
  "first-edition": 100 / 62,
  gift: 100 / 60,
  reread: 1,
  loved: 100 / 92,
  "book-club": 1,
  award: 1,
  bargain: 1,
  rare: 100 / 64,
  holiday: 1,
};

/** A die-cut edge: the shape again, a little larger, in white. */
function Edge({ d }: { d: string }) {
  return <path d={d} fill="#fff" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />;
}

function Words({
  y,
  size,
  children,
  fill,
  font = SERIF,
  spacing = 1,
  x = 50,
}: {
  y: number;
  size: number;
  children: string;
  fill: string;
  font?: string;
  spacing?: number;
  x?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontFamily={font}
      fontSize={size}
      fontWeight="700"
      letterSpacing={spacing}
      fill={fill}
    >
      {children}
    </text>
  );
}

/** Each sticker's drawing, in its own viewBox (100 wide). */
const ART: Record<StickerKey, React.ReactNode> = {
  signed: (
    <>
      <path d={SEAL_EDGE} fill="#fff" />
      <path d={SEAL} fill="url(#stk-gold)" />
      <circle cx="50" cy="50" r="35" fill="none" stroke="#8a5f12" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="32" fill="none" stroke="#fff6cf" strokeOpacity="0.6" strokeWidth="0.8" />
      <path d="M33 37q5-5 9 0t9 0 9 0 7-1" fill="none" stroke="#5a3d0a" strokeWidth="1.4" strokeLinecap="round" />
      <Words y={56} size={15} fill="#4a3208" spacing={1.2}>
        SIGNED
      </Words>
      <Words y={69} size={8} fill="#5a3d0a" font={SANS} spacing={2}>
        COPY
      </Words>
    </>
  ),
  "first-edition": (
    <>
      <rect x="2.5" y="2.5" width="95" height="57" rx="6" fill="#fff" stroke="#fff" strokeWidth="5" />
      <rect x="4" y="4" width="92" height="54" rx="4" fill="#f8f1df" />
      <rect x="8.5" y="8.5" width="83" height="45" rx="2" fill="none" stroke="#9e1b2c" strokeWidth="1.8" />
      <rect x="12" y="12" width="76" height="38" rx="1" fill="none" stroke="#9e1b2c" strokeWidth="0.7" />
      <Words y={30} size={14} fill="#9e1b2c" spacing={3}>
        FIRST
      </Words>
      <Words y={44} size={10.5} fill="#9e1b2c" spacing={2}>
        EDITION
      </Words>
    </>
  ),
  gift: (
    <>
      <Edge d={TAG} />
      <path d={TAG} fill="url(#stk-gift)" />
      <path d="M24 9H91V51H24L10 30Z" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.8" strokeDasharray="2 2" />
      <circle cx="19" cy="30" r="4.2" fill="#fbf4e8" stroke="#8f1a2e" strokeWidth="1" />
      <Words x={59} y={37.5} size={19} fill="#fff" font={SANS} spacing={3}>
        GIFT
      </Words>
    </>
  ),
  reread: (
    <>
      {/* A rubber stamp, inked on a round paper label so it shows on any
          cover. */}
      <circle cx="50" cy="50" r="48.5" fill="#fff" />
      <circle cx="50" cy="50" r="45" fill="#f6f0e2" />
      <g fill="none" stroke="#1d6a86" strokeOpacity="0.9">
        <circle cx="50" cy="50" r="40" strokeWidth="2.8" />
        <circle cx="50" cy="50" r="35.5" strokeWidth="1" />
        <path d="M30 36A24 24 0 0 1 69 33" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M70 64A24 24 0 0 1 31 67" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M62 27l8 6-9 3" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M38 73l-8-6 9-3" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g opacity="0.9">
        <Words y={55} size={13} fill="#1d6a86" font={SANS} spacing={0.5}>
          RE-READ
        </Words>
      </g>
    </>
  ),
  loved: (
    <>
      <path d={HEART} fill="#fff" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
      <path d={HEART} fill="url(#stk-heart)" />
      <ellipse cx="29" cy="24" rx="12" ry="7" fill="#fff" fillOpacity="0.42" transform="rotate(-30 29 24)" />
      <Words y={50} size={12} fill="#fff" font={SANS} spacing={1.5}>
        LOVED
      </Words>
    </>
  ),
  "book-club": (
    <>
      <circle cx="50" cy="50" r="48.5" fill="#fff" />
      <circle cx="50" cy="50" r="45" fill="#1f2f5c" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#e9d9a6" strokeWidth="1.1" strokeDasharray="0.5 3" strokeLinecap="round" />
      <Words y={30} size={8} fill="#e2c27a" spacing={3}>
        ✦✦✦
      </Words>
      <Words y={52} size={15} fill="#f4ead0" spacing={2.5}>
        BOOK
      </Words>
      <Words y={68} size={15} fill="#f4ead0" spacing={2.5}>
        CLUB
      </Words>
    </>
  ),
  award: (
    <>
      <circle cx="50" cy="50" r="48.5" fill="#fff" />
      <circle cx="50" cy="50" r="45" fill="url(#stk-gold)" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#8a5f12" strokeOpacity="0.6" strokeWidth="0.9" />
      <g fill="#7a5410" fillOpacity="0.85">
        {laurel(32, 150, 235, 6)}
        {laurel(32, 30, -55, 6)}
      </g>
      <Words y={47} size={9.5} fill="#4a3208" font={SANS} spacing={2}>
        AWARD
      </Words>
      <Words y={62} size={12.5} fill="#4a3208" spacing={1}>
        WINNER
      </Words>
    </>
  ),
  bargain: (
    <>
      <path d={BURST_EDGE} fill="#fff" />
      <path d={BURST} fill="#ffd23a" />
      <path d={star(50, 50, 16, 41, 35)} fill="none" stroke="#e8a908" strokeWidth="0.8" />
      <g transform="rotate(-10 50 50)">
        <Words y={47} size={9} fill="#b0162a" font={SANS} spacing={1.5}>
          GREAT
        </Words>
        <Words y={62} size={14} fill="#b0162a" font={SANS} spacing={0.5}>
          BARGAIN
        </Words>
      </g>
    </>
  ),
  rare: (
    <>
      <ellipse cx="50" cy="32" rx="48.5" ry="30.5" fill="#fff" />
      <ellipse cx="50" cy="32" rx="45" ry="27" fill="#1a1612" />
      <ellipse cx="50" cy="32" rx="39.5" ry="21.5" fill="none" stroke="url(#stk-gold)" strokeWidth="1.3" />
      <Words y={39.5} size={19} fill="url(#stk-gold)" spacing={4}>
        RARE
      </Words>
    </>
  ),
  holiday: (
    <>
      <path d={RAYS_EDGE} fill="#fff" />
      <path d={RAYS} fill="#f2922a" />
      <circle cx="50" cy="50" r="33" fill="#ffd45a" />
      <circle cx="50" cy="50" r="29.5" fill="none" stroke="#f2922a" strokeWidth="0.8" />
      <Words y={48} size={9.5} fill="#a8401a" font={SANS} spacing={1.5}>
        HOLIDAY
      </Words>
      <Words y={62} size={13} fill="#a8401a" font={SANS} spacing={2}>
        READ
      </Words>
    </>
  ),
};

/** Each sticker's viewBox. */
function viewBox(key: StickerKey): string {
  return `0 0 100 ${Math.round(100 / RATIO[key])}`;
}

/** The symbols, once per page (app/(app)/layout.tsx). */
export function StickerSprite() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="stk-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1ad" />
          <stop offset="0.3" stopColor="#e3bb52" />
          <stop offset="0.52" stopColor="#b8862b" />
          <stop offset="0.74" stopColor="#f0d27c" />
          <stop offset="1" stopColor="#a5741c" />
        </linearGradient>
        <linearGradient id="stk-heart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2647c" />
          <stop offset="1" stopColor="#c21d44" />
        </linearGradient>
        <linearGradient id="stk-gift" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d93a4f" />
          <stop offset="1" stopColor="#a8203a" />
        </linearGradient>
      </defs>
      {STICKERS.map((s) => (
        <symbol key={s.key} id={`sticker-${s.key}`} viewBox={viewBox(s.key)}>
          {ART[s.key]}
        </symbol>
      ))}
    </svg>
  );
}

/** One sticker, drawn from its symbol. */
export function StickerArt({
  sticker,
  style,
  ...rest
}: { sticker: StickerKey } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={viewBox(sticker)}
      style={{ aspectRatio: RATIO[sticker], ...style }}
      aria-hidden="true"
      {...rest}
    >
      <use href={`#sticker-${sticker}`} />
    </svg>
  );
}

/**
 * A cover's stickers (BookCover in components/book-card.tsx), in the order
 * they were pinned: the first at the top right, then the bottom right, the
 * bottom left and the top left; a small cover shows only the first two,
 * and the smallest none (globals.css, "Stickers"). Each sits a little off
 * straight. Ones in `fresh` were pinned just now and press on.
 */
export function CoverStickers({
  title,
  stickers,
  fresh,
}: {
  title: string;
  stickers: readonly string[];
  fresh?: readonly string[];
}) {
  const shown = stickers.filter((k) => stickerOf(k)).slice(0, 4) as StickerKey[];
  if (shown.length === 0) return null;
  return (
    <span className="cover-stickers" aria-hidden="true">
      {shown.map((key, at) => (
        <StickerArt
          key={key}
          sticker={key}
          className={cn("cover-sticker", fresh?.includes(key) && "is-fresh")}
          style={{ rotate: `${stickerTilt(title, key)}deg` }}
          data-at={at}
        />
      ))}
    </span>
  );
}
