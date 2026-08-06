import { AbsoluteFill, interpolate, Series, useCurrentFrame, useVideoConfig } from "remotion";
import { Session } from "./components/Session";
import { StepLabel } from "./components/StepLabel";
import { Terminal } from "./components/Terminal";
import { TitleCard } from "./components/TitleCard";
import { introTagline, introTitle, outroInstall, outroRepo } from "./script";
import { type Format, f, theme } from "./theme";
import { buildTimeline } from "./timeline";

export const INTRO_FRAMES = f(70);
export const OUTRO_FRAMES = f(95);
export const SESSION_TAIL = f(24);

const margins: Record<Format, number> = { landscape: 96, square: 52, vertical: 56 };
const cardScale: Record<Format, number> = { landscape: 1, square: 0.78, vertical: 0.95 };

export const sessionFrames = (): number => buildTimeline().total + SESSION_TAIL;
export const totalFrames = (): number => INTRO_FRAMES + sessionFrames() + OUTRO_FRAMES;

const FadeIn: React.FC<{ children: React.ReactNode; frames?: number }> = ({ children, frames = f(12) }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, frames], [0, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const DemoVideo: React.FC<{ format: Format }> = ({ format }) => {
  const { width, height } = useVideoConfig();
  const timeline = buildTimeline();
  const fontSize = format === "square" ? 26 : 30;
  const labelSize = fontSize * 0.78;
  const margin = margins[format];

  const labelBlock = labelSize * 2.4;
  const gap = margin * 0.55;
  const termW = width - margin * 2;
  const termH = height - margin * 2 - labelBlock - gap;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.pageBg }}>
      <Series>
        <Series.Sequence durationInFrames={INTRO_FRAMES}>
          <FadeIn>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <TitleCard wordmark={introTitle} primary={introTagline} scale={cardScale[format]} />
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>

        <Series.Sequence durationInFrames={sessionFrames()}>
          <FadeIn>
            <AbsoluteFill
              style={{
                padding: margin,
                flexDirection: "column",
                alignItems: "stretch",
                gap,
              }}
            >
              <div style={{ display: "flex", justifyContent: format === "vertical" ? "center" : "flex-start" }}>
                <StepLabel ranges={timeline.ranges} fontSize={labelSize} />
              </div>
              <Terminal width={termW} height={termH} title="you@acme — ~ — zsh" bodyPadding={margin * 0.5}>
                <Session timeline={timeline} fontSize={fontSize} />
              </Terminal>
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>

        <Series.Sequence durationInFrames={OUTRO_FRAMES}>
          <FadeIn>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <TitleCard wordmark={introTitle} primary={outroInstall} secondary={outroRepo} scale={cardScale[format]} mono />
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>
      </Series>
      <Scanlines />
    </AbsoluteFill>
  );
};

// Faint CRT scanlines over everything — nods to the brand's retro-computing /
// scanline motif without harming legibility.
export const Scanlines: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)",
      mixBlendMode: "multiply",
      opacity: 0.5,
    }}
  />
);
