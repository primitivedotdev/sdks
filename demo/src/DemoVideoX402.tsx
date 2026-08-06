import { AbsoluteFill, interpolate, Series, useCurrentFrame, useVideoConfig } from "remotion";
import { ExplainerPanel } from "./components/ExplainerPanel";
import { Session } from "./components/Session";
import { StepLabel } from "./components/StepLabel";
import { Terminal } from "./components/Terminal";
import { TitleCard } from "./components/TitleCard";
import { Scanlines, SESSION_TAIL } from "./DemoVideo";
import {
  x402Caption,
  x402IntroTitle,
  x402OutroInstall,
  x402Sections,
} from "./scriptX402";
import { type Format, f, theme } from "./theme";
import { buildTimeline } from "./timeline";

// Explains x402 agent-to-agent payments: terminal + plain-language narration
// panel, three beats (request → sign & settle → guardrails). Bookended by a
// logo card captioned "agent payments", matching the agent-signup clip so the
// launch-week series reads as one set.
const SLOW = { holdScale: 1.3, leadInFrames: 36 };

// Logo bookends: 3s at the start, 1.5s at the end. (FPS = 60; f() maps from the
// 30fps baseline, so f(90)=3s and f(45)=1.5s.)
export const INTRO_LOGO_FRAMES = f(90);
export const OUTRO_LOGO_FRAMES = f(45);

// Extra dwell on the final content screen (the spend policy) before the closing
// logo — holds the finished terminal on screen an additional 2.5s.
export const END_PAUSE_FRAMES = f(75);

export const x402SessionFrames = (): number =>
  buildTimeline(x402Sections, SLOW).total + SESSION_TAIL + END_PAUSE_FRAMES;
export const x402TotalFrames = (): number => INTRO_LOGO_FRAMES + x402SessionFrames() + OUTRO_LOGO_FRAMES;

const cardScale: Record<Format, number> = { landscape: 1, square: 0.78, vertical: 0.95 };

interface Cfg {
  margin: number;
  gap: number;
  row: boolean;
  fontSize: number;
  panelFont: number;
  labelSize: number;
}
const cfg: Record<Format, Cfg> = {
  landscape: { margin: 80, gap: 40, row: true, fontSize: 28, panelFont: 24, labelSize: 22 },
  square: { margin: 44, gap: 26, row: false, fontSize: 23, panelFont: 18, labelSize: 18 },
  vertical: { margin: 48, gap: 32, row: false, fontSize: 30, panelFont: 25, labelSize: 23 },
};

const FadeIn: React.FC<{ children: React.ReactNode; frames?: number }> = ({ children, frames = f(12) }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, frames], [0, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const DemoVideoX402: React.FC<{ format: Format }> = ({ format }) => {
  const { width, height } = useVideoConfig();
  const timeline = buildTimeline(x402Sections, SLOW);
  const c = cfg[format];

  const innerW = width - c.margin * 2;
  const labelBlock = c.labelSize * 2.4;
  const areaH = height - c.margin * 2 - labelBlock - c.gap;

  let termW: number;
  let termH: number;
  let panelW: number;
  let panelH: number;
  if (c.row) {
    panelW = Math.round(innerW * 0.36);
    termW = innerW - panelW - c.gap;
    termH = areaH;
    panelH = areaH;
  } else {
    panelH = Math.round(areaH * (format === "vertical" ? 0.26 : 0.32));
    termH = areaH - panelH - c.gap;
    termW = innerW;
    panelW = innerW;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: theme.pageBg }}>
      <Series>
        {/* Logo bookend — 3s, captioned "agent payments". */}
        <Series.Sequence durationInFrames={INTRO_LOGO_FRAMES}>
          <FadeIn>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <TitleCard wordmark={x402IntroTitle} primary={x402Caption} scale={cardScale[format]} />
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>

        <Series.Sequence durationInFrames={x402SessionFrames()}>
          <FadeIn>
            <AbsoluteFill style={{ padding: c.margin, flexDirection: "column", gap: c.gap }}>
              <div style={{ display: "flex", justifyContent: c.row ? "flex-start" : "center" }}>
                <StepLabel ranges={timeline.ranges} fontSize={c.labelSize} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: c.row ? "row" : "column", gap: c.gap, minHeight: 0 }}>
                <Terminal width={termW} height={termH} title="agent@laptop — ~ — zsh" bodyPadding={Math.round(c.fontSize * 1.3)}>
                  <Session timeline={timeline} fontSize={c.fontSize} />
                </Terminal>
                <div style={{ width: panelW, height: panelH }}>
                  <ExplainerPanel ranges={timeline.ranges} fontSize={c.panelFont} sections={x402Sections} />
                </div>
              </div>
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>

        {/* Logo bookend — 1.5s, captioned "agent payments" + SDK install CTA. */}
        <Series.Sequence durationInFrames={OUTRO_LOGO_FRAMES}>
          <FadeIn>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <TitleCard
                wordmark={x402IntroTitle}
                primary={x402Caption}
                secondary={x402OutroInstall}
                scale={cardScale[format]}
              />
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>
      </Series>
      <Scanlines />
    </AbsoluteFill>
  );
};
