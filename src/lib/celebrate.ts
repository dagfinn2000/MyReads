import { motionAllowed } from "@/lib/motion";
import type { Celebration } from "@/lib/preferences";

/**
 * A short celebration for finishing a book or reaching a goal, in the style
 * chosen under Preferences › Motion (`data-celebration` on <html>, set by
 * the root layout): confetti, fireworks, gold sparkles or petals falling.
 *
 * Each is drawn on a canvas laid over the page for the length of the
 * effect, then removed; nothing to install and nothing left behind. Nothing
 * happens when the reader chose no celebration, has animations off, or the
 * device asks for reduced motion.
 */
export function celebrate(origin?: Element | null): void {
  const rect = origin?.getBoundingClientRect();
  const at = rect
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 4 };
  play((document.documentElement.dataset.celebration ?? "confetti") as Celebration, at);
}

/** Plays `style` once from the middle of the screen, so Preferences can
 *  show what a choice looks like as it's picked. */
export function previewCelebration(style: Celebration): void {
  play(style, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
}

function play(style: Celebration, at: Point) {
  if (!motionAllowed() || style === "off") return;
  const stage = openStage();
  if (stage) (EFFECTS[style] ?? confetti)(stage, at);
}

type Point = { x: number; y: number };

interface Stage {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Calls `frame` on every animation frame until `duration` milliseconds
   *  have passed, then takes the canvas away. `step` is how many 60 Hz
   *  frames' worth of time the frame covers, so the effects move at the
   *  same speed on a 120 Hz screen as on a 60 Hz one. */
  run(duration: number, frame: (elapsed: number, step: number) => void): void;
}

type Effect = (stage: Stage, at: Point) => void;

/** A full-window canvas over everything, that no click lands on. */
function openStage(): Stage | null {
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
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  document.body.appendChild(canvas);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  return {
    ctx,
    width,
    height,
    run(duration, frame) {
      const start = performance.now();
      let last = start;
      const tick = (now: number) => {
        const elapsed = now - start;
        // A dropped frame or a hidden tab doesn't make things leap.
        const step = Math.min(3, Math.max(0, (now - last) / (1000 / 60)));
        last = now;
        ctx.clearRect(0, 0, width, height);
        ctx.globalAlpha = 1;
        frame(elapsed, step);
        if (elapsed < duration) requestAnimationFrame(tick);
        else canvas.remove();
      };
      requestAnimationFrame(tick);
    },
  };
}

/** The reader's accent colour, as the page has it. */
function accent(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const spread = (size: number) => (Math.random() - 0.5) * size;

// ── Confetti ──────────────────────────────────────────────────────────────

/** A burst of paper confetti thrown up from the origin, falling back. */
const confetti: Effect = (stage, at) => {
  const DURATION = 1700;
  // Gold for the medal, the reader's accent, and a few bright ones.
  const colours = ["#f59e0b", "#fde68a", "#dc2626", "#10b981", "#38bdf8", "#a78bfa", accent() || "#f59e0b"];
  const pieces = Array.from({ length: 90 }, () => {
    // Mostly upwards, fanned out to either side.
    const angle = -Math.PI / 2 + spread(Math.PI * 1.2);
    const speed = 5 + Math.random() * 7;
    return {
      x: at.x,
      y: at.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: Math.random() * Math.PI,
      vspin: spread(0.4),
      size: 5 + Math.random() * 5,
      colour: pick(colours),
    };
  });
  const { ctx } = stage;
  stage.run(DURATION, (elapsed, step) => {
    ctx.globalAlpha = Math.max(0, 1 - elapsed / DURATION);
    for (const p of pieces) {
      p.vy += 0.25 * step; // gravity
      p.vx *= 0.985 ** step; // air
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.spin += p.vspin * step;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.colour;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
  });
};

// ── Fireworks ─────────────────────────────────────────────────────────────

/** Three rockets go up from the foot of the screen below the origin, one
 *  after another, and each bursts at the top of its climb into a ring of
 *  sparks that droop, glitter and fade. */
const fireworks: Effect = (stage, at) => {
  const DURATION = 3000;
  const RISE = 0.5; // the rockets' gravity, px per frame²
  // Deep enough to show on a pale page as well as a dark one. Not the
  // accent: on many themes that's near black, and a black firework is soot.
  const colours = ["#f59e0b", "#ec4899", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#14b8a6"];
  const { width, height, ctx } = stage;

  // Each rocket a different colour.
  const shells = [...colours].sort(() => Math.random() - 0.5);
  const rockets = [0, 320, 640].map((launch, i) => {
    const x = Math.min(width - 24, Math.max(24, at.x + (i - 1) * 36));
    const y = height + 8;
    const targetX = width * (0.22 + 0.28 * i) + spread(width * 0.1);
    const targetY = height * (0.12 + Math.random() * 0.18);
    // Fast enough to stop just at the target.
    const v = Math.sqrt(2 * RISE * (y - targetY));
    return { launch, x, y, vx: (targetX - x) / (v / RISE), vy: -v, burst: false, colour: shells[i] };
  });
  type Spark = { x: number; y: number; vx: number; vy: number; born: number; life: number; colour: string; size: number };
  const sparks: Spark[] = [];
  const trail: Spark[] = [];
  const flashes: { x: number; y: number; born: number; colour: string }[] = [];

  stage.run(DURATION, (elapsed, step) => {
    for (const r of rockets) {
      if (r.burst || elapsed < r.launch) continue;
      r.vy += RISE * step;
      r.x += r.vx * step;
      r.y += r.vy * step;
      trail.push({ x: r.x + spread(2), y: r.y, vx: 0, vy: 0.6, born: elapsed, life: 420, colour: "#f59e0b", size: 1.3 });
      if (r.vy < 0) continue;
      r.burst = true;
      flashes.push({ x: r.x, y: r.y, born: elapsed, colour: r.colour });
      const count = 72;
      for (let k = 0; k < count; k++) {
        const angle = (k / count) * Math.PI * 2 + spread(0.08);
        // Two shells, one inside the other.
        const speed = k % 3 ? 4.4 + Math.random() * 1.4 : 2.4 + Math.random() * 0.9;
        sparks.push({
          x: r.x,
          y: r.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          born: elapsed,
          life: 1150 + Math.random() * 550,
          colour: k % 5 ? r.colour : "#fbbf24",
          size: k % 3 ? 1.7 : 1.3,
        });
      }
    }

    for (const f of flashes) {
      const age = (elapsed - f.born) / 260;
      if (age >= 1) continue;
      const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 46);
      glow.addColorStop(0, f.colour);
      glow.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.45 * (1 - age);
      ctx.fillStyle = glow;
      ctx.fillRect(f.x - 46, f.y - 46, 92, 92);
    }
    for (const t of trail) {
      const age = (elapsed - t.born) / t.life;
      if (age >= 1) continue;
      t.y += t.vy * step;
      dot(ctx, t.x, t.y, t.size, t.colour, 0.7 * (1 - age));
    }
    for (const r of rockets) {
      if (!r.burst && elapsed >= r.launch) dot(ctx, r.x, r.y, 2.4, "#fbbf24", 1);
    }
    for (const s of sparks) {
      const age = (elapsed - s.born) / s.life;
      if (age >= 1) continue;
      s.vx *= 0.965 ** step;
      s.vy = s.vy * 0.965 ** step + 0.05 * step;
      s.x += s.vx * step;
      s.y += s.vy * step;
      // Glittering as it dies.
      const glitter = age > 0.55 ? 0.55 + 0.45 * Math.sin(elapsed / 38 + s.born) : 1;
      const fade = (1 - age * age) * glitter;
      // A streak behind it while it's fast, a point once it slows.
      streak(ctx, s.x, s.y, s.vx * 3.5, s.vy * 3.5, s.size * 3, s.colour, 0.14 * fade);
      streak(ctx, s.x, s.y, s.vx * 3.5, s.vy * 3.5, s.size, s.colour, fade);
    }
  });
};

/** A line `width` thick, round at the ends, from (x - dx, y - dy) to (x, y). */
function streak(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  width: number,
  colour: string,
  alpha: number,
) {
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - dx, y - dy);
  ctx.lineTo(x, y);
  ctx.stroke();
}

/** A round dot of `colour` at `alpha`. */
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string, alpha: number) {
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ── Gold sparkles ─────────────────────────────────────────────────────────

/** Four-pointed gold stars spread softly out from the origin, turning and
 *  twinkling as they drift up a little and fade. */
const sparkles: Effect = (stage, at) => {
  const DURATION = 1900;
  const golds = ["#f5c542", "#fde68a", "#fbbf24", "#e0a526", "#fff0b8"];
  const stars = Array.from({ length: 46 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 7;
    return {
      x: at.x,
      y: at.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      size: 4 + Math.random() * 9,
      turn: Math.random() * Math.PI,
      spin: spread(0.08),
      phase: Math.random() * Math.PI * 2,
      delay: Math.random() * 220,
      colour: pick(golds),
    };
  });
  const { ctx } = stage;
  stage.run(DURATION, (elapsed, step) => {
    for (const s of stars) {
      if (elapsed < s.delay) continue;
      s.vx *= 0.94 ** step;
      s.vy = s.vy * 0.94 ** step - 0.015 * step;
      s.x += s.vx * step;
      s.y += s.vy * step;
      s.turn += s.spin * step;
      const life = (elapsed - s.delay) / (DURATION - s.delay);
      const twinkle = 0.7 + 0.3 * Math.sin(elapsed / 90 + s.phase);
      ctx.globalAlpha = Math.max(0, 1 - life * life);
      sparkle(ctx, s.x, s.y, s.size * twinkle, s.turn, s.colour);
    }
  });
};

/** A four-pointed star with fine tips. Outlined in a deeper gold, so the
 *  pale ones still show on a pale page. */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, turn: number, colour: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.quadraticCurveTo(0, 0, 0, r);
  ctx.quadraticCurveTo(0, 0, -r, 0);
  ctx.quadraticCurveTo(0, 0, 0, -r);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.lineWidth = 0.75;
  ctx.strokeStyle = "rgb(180 110 10 / 0.55)";
  ctx.stroke();
  ctx.restore();
}

// ── Petals ────────────────────────────────────────────────────────────────

/** Blossom petals drift down from the top of the screen, swaying and
 *  tumbling as they fall, thickest above the origin. */
const petals: Effect = (stage, at) => {
  const DURATION = 3400;
  const pinks = ["#fbcfe0", "#f9a8c4", "#fde4ec", "#fff1f5", "#f5b5c8"];
  const flakes = Array.from({ length: 48 }, () => {
    // Half fall near the origin, the rest anywhere across the top.
    const near = Math.random() < 0.5;
    return {
      x: near ? at.x + spread(320) : Math.random() * stage.width,
      y: -20 - Math.random() * stage.height * 0.3,
      fall: 2.2 + Math.random() * 1.8,
      sway: 0.6 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      size: 6 + Math.random() * 6,
      turn: Math.random() * Math.PI,
      spin: spread(0.06),
      colour: pick(pinks),
    };
  });
  const { ctx } = stage;
  stage.run(DURATION, (elapsed, step) => {
    // Fading out over the last 0.7 s rather than vanishing.
    const fade = Math.min(1, (DURATION - elapsed) / 700);
    ctx.globalAlpha = Math.max(0, fade) * 0.95;
    for (const p of flakes) {
      p.y += p.fall * step;
      p.x += Math.sin(elapsed / 420 + p.phase) * p.sway * step;
      p.turn += p.spin * step;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.turn);
      // Squashed as it turns over, so it seems to tumble.
      ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(elapsed / 300 + p.phase)));
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.bezierCurveTo(p.size * 0.9, -p.size * 0.6, p.size * 0.7, p.size * 0.7, 0, p.size);
      ctx.bezierCurveTo(-p.size * 0.7, p.size * 0.7, -p.size * 0.9, -p.size * 0.6, 0, -p.size);
      ctx.fillStyle = p.colour;
      ctx.fill();
      // A rosy edge and vein, so the palest still show on a pale page.
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = "rgb(214 96 140 / 0.45)";
      ctx.stroke();
      ctx.fillStyle = "rgb(214 96 140 / 0.25)";
      ctx.fillRect(-0.5, -p.size * 0.6, 1, p.size * 1.2);
      ctx.restore();
    }
  });
};

const EFFECTS: Record<Exclude<Celebration, "off">, Effect> = { confetti, fireworks, sparkles, petals };
