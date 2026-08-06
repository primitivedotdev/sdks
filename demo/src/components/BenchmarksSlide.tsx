import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { f, monoFamily, theme } from "../theme";
import { Logo } from "./Logo";

interface Stat {
  value: string;
  label: string;
}

const STATS: Stat[] = [
  { value: "~250ms", label: "end-to-end, one primitive address to another" },
  { value: "2 min", label: "to fully deploy an agent to primitive" },
  { value: "40× cheaper", label: "98% margins vs. other agent-native email platforms" },
  { value: "#1 in Dev Tools\n#2 Overall", label: "on ora.ai — a leading agent-readiness benchmark" },
];

// Deck-style closing slide: primitive-branded benchmarks grid.
export const BenchmarksSlide: React.FC<{ format: "landscape" | "square" | "vertical" }> = ({ format }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = format === "square" ? 0.8 : format === "vertical" ? 0.92 : 1;
  const cols = format === "vertical" ? 1 : 2;

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: f(20) });
  const headerY = interpolate(enter, [0, 1], [20, 0]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40 * scale,
        padding: 80 * scale,
        boxSizing: "border-box",
      }}
    >
      {/* Brand header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 * scale, opacity: enter, transform: `translateY(${headerY}px)` }}>
        <Logo fontSize={8 * scale} />
        <div style={{ fontFamily: monoFamily, fontSize: 40 * scale, fontWeight: 800, color: theme.cardText, letterSpacing: "-0.02em" }}>
          primitive
        </div>
        <div style={{ fontFamily: monoFamily, fontSize: 19 * scale, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: theme.accent }}>
          by the numbers
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 28 * scale,
          width: "100%",
          maxWidth: format === "vertical" ? 820 * scale : 1480 * scale,
        }}
      >
        {STATS.map((stat, i) => {
          const local = spring({ frame, fps, config: { damping: 200 }, durationInFrames: f(18), delay: f(8) + i * f(7) });
          return (
            <div
              key={stat.value}
              style={{
                border: `2px solid ${theme.windowBorder}`,
                boxShadow: `8px 8px 0 0 ${theme.accentDeep}`,
                backgroundColor: theme.baseDarkSecondary,
                padding: `${30 * scale}px ${34 * scale}px`,
                display: "flex",
                flexDirection: "column",
                gap: 12 * scale,
                opacity: local,
                transform: `translateY(${interpolate(local, [0, 1], [22, 0])}px)`,
              }}
            >
              <div style={{ fontFamily: monoFamily, fontSize: 52 * scale, fontWeight: 800, color: theme.success, letterSpacing: "-0.02em", lineHeight: 1.05, whiteSpace: "pre-line" }}>
                {stat.value}
              </div>
              <div style={{ fontFamily: monoFamily, fontSize: 23 * scale, fontWeight: 500, color: theme.dim, lineHeight: 1.45 }}>
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer URL */}
      <div style={{ fontFamily: monoFamily, fontSize: 30 * scale, fontWeight: 700, color: theme.cardText, opacity: enter, letterSpacing: "0.01em" }}>
        https://primitive.dev
      </div>
    </div>
  );
};
