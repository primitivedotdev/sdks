import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { f, monoFamily, theme } from "../theme";
import { Logo } from "./Logo";

// Intro/outro card: braille-art mark + lowercase mono wordmark + supporting
// line, brutalist styling. `mono` renders `primary` as a green command chip.
export const TitleCard: React.FC<{
  wordmark: string;
  primary: string;
  secondary?: string;
  scale: number;
  mono?: boolean;
  // Render the (non-mono) tagline lowercase as a sentence instead of the
  // default uppercase tracked label.
  taglineLower?: boolean;
  // Optional green mono chip rendered at the very bottom (e.g. a CTA URL),
  // below the tagline/secondary line.
  chip?: string;
}> = ({ wordmark, primary, secondary, scale, mono, taglineLower, chip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: f(24) });
  const y = interpolate(enter, [0, 1], [24, 0]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28 * scale,
        opacity: enter,
        transform: `translateY(${y}px)`,
      }}
    >
      <Logo fontSize={13 * scale} />
      <div
        style={{
          fontFamily: monoFamily,
          fontSize: 68 * scale,
          fontWeight: 800,
          color: theme.cardText,
          letterSpacing: "-0.02em",
        }}
      >
        {wordmark}
      </div>
      {mono ? (
        // Install command as a brutalist green-bordered chip.
        <div
          style={{
            fontFamily: monoFamily,
            fontSize: 28 * scale,
            fontWeight: 700,
            color: theme.success,
            border: `2px solid ${theme.accentDeep}`,
            boxShadow: `5px 5px 0 0 ${theme.accentDeep}`,
            backgroundColor: theme.baseDarkSecondary,
            padding: `${10 * scale}px ${18 * scale}px`,
          }}
        >
          {primary}
        </div>
      ) : (
        <div
          style={{
            fontFamily: monoFamily,
            fontSize: 30 * scale,
            fontWeight: 700,
            textTransform: taglineLower ? "none" : "uppercase",
            letterSpacing: taglineLower ? "0.01em" : "0.22em",
            color: taglineLower ? theme.cardText : theme.cardDim,
          }}
        >
          {primary}
        </div>
      )}
      {secondary ? (
        <div style={{ fontFamily: monoFamily, fontSize: 22 * scale, color: theme.cardDim, letterSpacing: "0.04em" }}>
          {secondary}
        </div>
      ) : null}
      {chip ? (
        <div
          style={{
            fontFamily: monoFamily,
            fontSize: 28 * scale,
            fontWeight: 700,
            color: theme.success,
            border: `2px solid ${theme.accentDeep}`,
            boxShadow: `5px 5px 0 0 ${theme.accentDeep}`,
            backgroundColor: theme.baseDarkSecondary,
            padding: `${10 * scale}px ${18 * scale}px`,
          }}
        >
          {chip}
        </div>
      ) : null}
    </div>
  );
};
