import { interpolate, useCurrentFrame } from "remotion";
import { f, monoFamily, theme } from "../theme";
import type { Section } from "../script";
import type { SectionRange } from "../timeline";

// A side panel for non-technical viewers: names the current step, explains in
// plain language what's happening, and previews what's coming next. `sections`
// is the storyline being narrated (drives "step n / N" and the "next" preview).
export const ExplainerPanel: React.FC<{
  ranges: SectionRange[];
  fontSize: number;
  sections: Section[];
  lowercase?: boolean;
}> = ({ ranges, fontSize, sections, lowercase }) => {
  const labelCase = lowercase ? "lowercase" : "uppercase";
  const frame = useCurrentFrame();
  const NARRATED = sections.filter((s) => s.explainer);
  const currentRange = ranges.find((r) => frame >= r.start && frame < r.end) ?? ranges[ranges.length - 1];
  const idx = NARRATED.findIndex((s) => s.id === currentRange.id);
  const section = NARRATED[Math.max(0, idx)];
  const explainer = section?.explainer;
  if (!explainer) return null;

  const nextHeading = NARRATED[idx + 1]?.explainer?.heading ?? "You're all set up";
  const since = frame - currentRange.start;
  const opacity = interpolate(since, [0, f(10)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dx = interpolate(since, [0, f(12)], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        height: "100%",
        boxSizing: "border-box",
        backgroundColor: theme.baseDarkSecondary,
        border: `2px solid ${theme.windowBorder}`,
        boxShadow: `10px 10px 0 0 ${theme.accentDeep}`,
        padding: fontSize * 1.6,
        display: "flex",
        flexDirection: "column",
        fontFamily: monoFamily,
      }}
    >
      {/* Progress badge */}
      <div
        style={{
          alignSelf: "flex-start",
          backgroundColor: theme.accentDeep,
          color: theme.baseLight,
          border: `2px solid ${theme.baseLight}`,
          boxShadow: `3px 3px 0 0 ${theme.baseLight}`,
          padding: `${fontSize * 0.25}px ${fontSize * 0.6}px`,
          fontSize: fontSize * 0.72,
          fontWeight: 800,
          textTransform: labelCase,
          letterSpacing: "0.12em",
        }}
      >
        Step {idx + 1} / {NARRATED.length}
      </div>

      <div key={section.id} style={{ opacity, transform: `translateX(${dx}px)`, marginTop: fontSize * 1.1, flex: 1 }}>
        <div
          style={{
            fontSize: fontSize * 1.55,
            fontWeight: 800,
            color: theme.text,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
          }}
        >
          {explainer.heading}
        </div>
        <div
          style={{
            marginTop: fontSize * 0.9,
            fontSize: fontSize * 0.98,
            lineHeight: 1.7,
            color: theme.cardText,
          }}
        >
          {explainer.body}
        </div>
      </div>

      {/* What's coming next */}
      <div
        style={{
          marginTop: fontSize,
          paddingTop: fontSize * 0.8,
          borderTop: `2px solid ${theme.windowBorder}`,
          fontSize: fontSize * 0.8,
          color: theme.amber,
          textTransform: labelCase,
          letterSpacing: "0.1em",
          fontWeight: 700,
        }}
      >
        Next → <span style={{ color: theme.text }}>{nextHeading}</span>
      </div>
    </div>
  );
};
