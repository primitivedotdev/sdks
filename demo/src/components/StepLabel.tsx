import { interpolate, useCurrentFrame } from "remotion";
import { f, monoFamily, theme } from "../theme";
import type { SectionRange } from "../timeline";

// Brutalist step badge: square, green fill, thick foreground border, hard
// offset shadow, uppercase + tracked — same language as the site's Beta badge.
export const StepLabel: React.FC<{ ranges: SectionRange[]; fontSize: number; lowercase?: boolean }> = ({
  ranges,
  fontSize,
  lowercase,
}) => {
  const frame = useCurrentFrame();
  const current = ranges.find((r) => frame >= r.start && frame < r.end) ?? ranges[ranges.length - 1];
  const since = frame - current.start;
  const opacity = interpolate(since, [0, f(8)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pop = interpolate(since, [0, f(10)], [0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      key={current.id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${fontSize * 0.34}px ${fontSize * 0.7}px`,
        backgroundColor: theme.accentDeep,
        border: `2px solid ${theme.baseLight}`,
        boxShadow: `4px 4px 0 0 ${theme.baseLight}`,
        fontFamily: monoFamily,
        fontSize,
        fontWeight: 800,
        textTransform: lowercase ? "lowercase" : "uppercase",
        letterSpacing: "0.1em",
        color: theme.baseLight,
        opacity,
        transform: `rotate(-3deg) scale(${pop})`,
      }}
    >
      {current.label}
    </div>
  );
};
