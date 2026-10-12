import { motionAllowed } from "@/lib/motion";

/** How long a burst lasts, in milliseconds. */
const DURATION = 1700;
const PIECES = 90;

/**
 * A short burst of confetti from `origin` (an element, or the top middle of
 * the screen when there is none), for finishing a book or reaching the
 * reading goal. Drawn on a canvas laid over the page for the length of the
 * burst, then removed; nothing to install and nothing left behind. Does
 * nothing when animations are off or the device asks for reduced motion.
 */
export function celebrate(origin?: Element | null): void {
  if (!motionAllowed()) return;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "100",
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const rect = origin?.getBoundingClientRect();
  const ox = rect ? rect.left + rect.width / 2 : width / 2;
  const oy = rect ? rect.top + rect.height / 2 : height / 4;

  // Gold for the medal, the reader's accent, and a few bright ones.
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  const colours = ["#f59e0b", "#fde68a", "#dc2626", "#10b981", "#38bdf8", "#a78bfa", accent || "#f59e0b"];

  const pieces = Array.from({ length: PIECES }, () => {
    // Mostly upwards, fanned out to either side.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
    const speed = 5 + Math.random() * 7;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: Math.random() * Math.PI,
      vspin: (Math.random() - 0.5) * 0.4,
      size: 5 + Math.random() * 5,
      colour: colours[Math.floor(Math.random() * colours.length)],
    };
  });

  const start = performance.now();
  function frame(now: number) {
    const elapsed = now - start;
    ctx!.clearRect(0, 0, width, height);
    ctx!.globalAlpha = Math.max(0, 1 - elapsed / DURATION);
    for (const p of pieces) {
      p.vy += 0.25; // gravity
      p.vx *= 0.985; // air
      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.vspin;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.spin);
      ctx!.fillStyle = p.colour;
      ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx!.restore();
    }
    if (elapsed < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
