import { useCurrentFrame, useVideoConfig } from "remotion";
import { LOGO_FONT, theme } from "../theme";
import { LOGO_ART } from "../logoArt";

// The real primitive.dev mark: braille-art rendered in the custom logo font,
// scaleX(1.25), with the site's idle conic-gradient hue-shift (6s loop).
export const Logo: React.FC<{ fontSize: number }> = ({ fontSize }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const loopFrames = fps * 6; // 6s hueShift loop, matching globals.css
  const hue = ((frame % loopFrames) / loopFrames) * 360;

  return (
    <pre
      aria-label="primitive"
      style={{
        margin: 0,
        fontFamily: `${LOGO_FONT}, ${monoFallback}`,
        fontSize,
        lineHeight: 1.37,
        letterSpacing: 0,
        whiteSpace: "pre",
        transform: "scaleX(1.25)",
        transformOrigin: "center",
        fontFeatureSettings: "'liga' 0, 'clig' 0, 'calt' 0",
        background: `conic-gradient(from 0deg at 50% 50%, ${theme.logoIdle1}, ${theme.logoIdle2}, ${theme.logoIdle3}, ${theme.logoIdle2}, ${theme.logoIdle1})`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        filter: `hue-rotate(${hue}deg)`,
        textRendering: "geometricPrecision",
      }}
    >
      {LOGO_ART}
    </pre>
  );
};

const monoFallback = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
