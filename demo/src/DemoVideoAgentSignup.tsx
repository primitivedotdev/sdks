import { AbsoluteFill, interpolate, Series, useCurrentFrame, useVideoConfig } from "remotion";
import { ExplainerPanel } from "./components/ExplainerPanel";
import { Session } from "./components/Session";
import { StepLabel } from "./components/StepLabel";
import { Terminal } from "./components/Terminal";
import { TitleCard } from "./components/TitleCard";
import { Scanlines, SESSION_TAIL } from "./DemoVideo";
import {
  agentSignupCaption,
  agentSignupIntroTitle,
  agentSignupOutroInstall,
  agentSignupSections,
} from "./scriptAgentSignup";
import { type Format, f, theme } from "./theme";
import { buildTimeline } from "./timeline";

// Explains the new agent signup flow: terminal + plain-language narration panel.
// Bookended by a 3-second logo card captioned "agent signup" at the start and
// end, per the brief. Paced tight so the whole clip lands under 20s while the
// narration panel still has time to read.
const SLOW = { holdScale: 1.3, leadInFrames: 36 };

// Logo bookends: 3s at the start, 1.5s at the end. (FPS = 60; f() maps from the
// 30fps baseline, so f(90)=3s and f(45)=1.5s.)
export const INTRO_LOGO_FRAMES = f(90);
export const OUTRO_LOGO_FRAMES = f(45);

// Extra dwell on the final content screen (step 2's output) before the closing
// logo — holds the finished terminal on screen an additional 2.5s.
export const END_PAUSE_FRAMES = f(75);

export const agentSignupSessionFrames = (): number =>
  buildTimeline(agentSignupSections, SLOW).total + SESSION_TAIL + END_PAUSE_FRAMES;
export const agentSignupTotalFrames = (): number => INTRO_LOGO_FRAMES + agentSignupSessionFrames() + OUTRO_LOGO_FRAMES;

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

export const DemoVideoAgentSignup: React.FC<{ format: Format }> = ({ format }) => {
  const { width, height } = useVideoConfig();
  const timeline = buildTimeline(agentSignupSections, SLOW);
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
        {/* Logo bookend — 3s, captioned "agent signup". */}
        <Series.Sequence durationInFrames={INTRO_LOGO_FRAMES}>
          <FadeIn>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <TitleCard wordmark={agentSignupIntroTitle} primary={agentSignupCaption} scale={cardScale[format]} />
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>

        <Series.Sequence durationInFrames={agentSignupSessionFrames()}>
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
                  <ExplainerPanel ranges={timeline.ranges} fontSize={c.panelFont} sections={agentSignupSections} />
                </div>
              </div>
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>

        {/* Logo bookend — 1.5s, captioned "agent signup" + CLI CTA. */}
        <Series.Sequence durationInFrames={OUTRO_LOGO_FRAMES}>
          <FadeIn>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <TitleCard
                wordmark={agentSignupIntroTitle}
                primary={agentSignupCaption}
                secondary={agentSignupOutroInstall}
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
