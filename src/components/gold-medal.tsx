/**
 * The gold medal awarded for hitting a yearly reading goal. Pure SVG so it
 * looks crisp at any size and needs no image assets.
 */
export function GoldMedal({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 64"
      className={className}
      role="img"
      aria-label="Gold medal"
    >
      <defs>
        <linearGradient id="medal-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="45%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      {/* Ribbon */}
      <path d="M14 0h8l4 14 4-14h8l-9 26h-10z" fill="#dc2626" />
      <path d="M22 0h4l2 7-4 7-4-7z" fill="#b91c1c" />
      {/* Medal disc */}
      <circle cx="24" cy="42" r="19" fill="url(#medal-gold)" />
      <circle
        cx="24"
        cy="42"
        r="15"
        fill="none"
        stroke="#fffbeb"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      {/* Star */}
      <path
        d="M24 32.5l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1-5.4-2.9-5.4 2.9 1.1-6.1-4.5-4.3 6.1-.8z"
        fill="#fffbeb"
        fillOpacity="0.9"
      />
    </svg>
  );
}
