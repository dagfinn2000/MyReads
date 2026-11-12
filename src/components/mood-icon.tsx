import {
  Anchor,
  Bird,
  Brain,
  Castle,
  Cat,
  CloudRain,
  Coffee,
  Compass,
  Cookie,
  Crown,
  Drama,
  Eye,
  Feather,
  Flame,
  Flower2,
  Gem,
  Ghost,
  Glasses,
  GraduationCap,
  Heart,
  Hourglass,
  KeyRound,
  Laugh,
  Leaf,
  Lightbulb,
  Moon,
  Mountain,
  Music,
  PartyPopper,
  Puzzle,
  Rocket,
  Skull,
  Smile,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Swords,
  Telescope,
  TreePine,
  Umbrella,
  WandSparkles,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { MOOD_ICON_TINT, type Mood, type MoodIcon as MoodIconName } from "@/lib/moods";
import { cn } from "@/lib/utils";

/** Each mood icon's lucide drawing (lib/moods.ts MOOD_ICONS). */
export const MOOD_ICON_COMPONENTS: Record<MoodIconName, LucideIcon> = {
  coffee: Coffee,
  laugh: Laugh,
  feather: Feather,
  heart: Heart,
  sunrise: Sunrise,
  "wand-sparkles": WandSparkles,
  sparkles: Sparkles,
  compass: Compass,
  lightbulb: Lightbulb,
  "graduation-cap": GraduationCap,
  mountain: Mountain,
  drama: Drama,
  "cloud-rain": CloudRain,
  "key-round": KeyRound,
  zap: Zap,
  ghost: Ghost,
  moon: Moon,
  smile: Smile,
  sun: Sun,
  flame: Flame,
  snowflake: Snowflake,
  leaf: Leaf,
  flower: Flower2,
  "tree-pine": TreePine,
  waves: Waves,
  wind: Wind,
  umbrella: Umbrella,
  music: Music,
  "party-popper": PartyPopper,
  cookie: Cookie,
  star: Star,
  gem: Gem,
  crown: Crown,
  castle: Castle,
  swords: Swords,
  rocket: Rocket,
  telescope: Telescope,
  anchor: Anchor,
  bird: Bird,
  cat: Cat,
  puzzle: Puzzle,
  brain: Brain,
  eye: Eye,
  glasses: Glasses,
  hourglass: Hourglass,
  skull: Skull,
};

/** A mood's icon in its own tint, unless `tinted` is false (it then takes
 *  the colour around it). Decorative: the mood's name is always beside it. */
export function MoodIcon({
  mood,
  className,
  tinted = true,
}: {
  mood: Pick<Mood, "icon" | "color">;
  className?: string;
  tinted?: boolean;
}) {
  const Icon = MOOD_ICON_COMPONENTS[mood.icon] ?? Smile;
  return (
    <Icon
      aria-hidden="true"
      data-slot="icon"
      className={cn("mood-icon size-3.5 shrink-0", tinted && MOOD_ICON_TINT[mood.color], className)}
    />
  );
}
