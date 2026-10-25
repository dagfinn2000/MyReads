"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { celebrate } from "@/lib/celebrate";
import { goalUnitWord, type DailyGoalTarget } from "@/lib/daily-goal";
import { useSound } from "@/components/sounds";
import { Card, CardContent } from "@/components/ui/card";

const SIZE = 72;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The daily goal on Now reading: a ring that fills as the day's pages (or
 * minutes) are logged, with what's left and how the goal has gone lately.
 * Logging refreshes the page, so the ring moves on by itself; crossing the
 * goal sets off a little celebration from the ring (when motion is allowed),
 * and a met goal keeps a soft glow.
 */
export function DailyGoalRing({
  target,
  today,
  met,
  headline,
  detail,
}: {
  target: DailyGoalTarget;
  today: number;
  met: boolean;
  headline: string;
  detail: string | null;
}) {
  const ringRef = useRef<SVGSVGElement>(null);
  const wasMet = useRef(met);
  const sound = useSound();
  const reached = useEffectEvent(() => {
    celebrate(ringRef.current);
    sound("goal");
  });

  // Only a goal reached while the page is open celebrates, not one already
  // met when the page opened.
  useEffect(() => {
    if (met && !wasMet.current) reached();
    wasMet.current = met;
  }, [met]);

  const fraction = Math.min(today / target.amount, 1);
  const offset = CIRCUMFERENCE * (1 - fraction);
  const word = goalUnitWord(target.unit, target.amount);

  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-4">
        <div className="relative shrink-0">
          <svg
            ref={ringRef}
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`${today} of ${target.amount} ${word} today`}
            className={met ? "goal-ring-met" : undefined}
          >
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              className="stroke-muted"
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              className="goal-ring-arc stroke-primary"
              style={
                {
                  strokeDashoffset: `${offset}px`,
                  "--ring-empty": `${CIRCUMFERENCE}px`,
                } as React.CSSProperties
              }
            />
          </svg>
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-content-center text-center leading-none tabular-nums"
          >
            {met ? (
              <Check className="size-6 text-primary" strokeWidth={2.5} />
            ) : (
              <>
                <span className="font-heading text-lg font-semibold">{today}</span>
                <span className="mt-0.5 text-[10px] text-muted-foreground">of {target.amount}</span>
              </>
            )}
          </span>
        </div>
        <div className="grid min-w-0 gap-0.5">
          <p className="font-heading font-medium">{headline}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {met
              ? `${today} of ${target.amount} ${word} today`
              : `${today} of ${target.amount} ${word} so far`}
            {detail && ` · ${detail}`}
          </p>
          <Link
            href="/account#reading"
            className="justify-self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Change the goal
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
