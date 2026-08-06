import { AbsoluteFill, interpolate, Series, useCurrentFrame, useVideoConfig } from "remotion";
import { ExplainerPanel } from "./components/ExplainerPanel";
import { Session } from "./components/Session";
import { StepLabel } from "./components/StepLabel";
import { Terminal } from "./components/Terminal";
import { TitleCard } from "./components/TitleCard";
import { INTRO_FRAMES, OUTRO_FRAMES, Scanlines, SESSION_TAIL } from "./DemoVideo";
import { introTagline, introTitle, outroInstall, outroRepo, sections } from "./script";
import { type Format, f, theme } from "./theme";
import { buildTimeline } from "./timeline";

// Slower, narrated cut: longer holds + a reading pause before each step.
const SLOW = { holdScale: 1.9, leadInFrames: 55 };

export const explainedSessionFrames = (): number => buildTimeline(sections, SLOW).total + SESSION_TAIL;
export const explainedTotalFrames = (): number => INTRO_FRAMES + explainedSessionFrames() + OUTRO_FRAMES;

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

export const DemoVideoExplained: React.FC<{ format: Format }> = ({ format }) => {
  const { width, height } = useVideoConfig();
  const timeline = buildTimeline(sections, SLOW);
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
        <Series.Sequence durationInFrames={INTRO_FRAMES}>
          <FadeIn>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <TitleCard wordmark={introTitle} primary={introTagline} scale={cardScale[format]} />
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>

        <Series.Sequence durationInFrames={explainedSessionFrames()}>
          <FadeIn>
            <AbsoluteFill style={{ padding: c.margin, flexDirection: "column", gap: c.gap }}>
              <div style={{ display: "flex", justifyContent: c.row ? "flex-start" : "center" }}>
                <StepLabel ranges={timeline.ranges} fontSize={c.labelSize} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: c.row ? "row" : "column", gap: c.gap, minHeight: 0 }}>
                <Terminal width={termW} height={termH} title="you@acme — ~ — zsh" bodyPadding={Math.round(c.fontSize * 1.3)}>
                  <Session timeline={timeline} fontSize={c.fontSize} />
                </Terminal>
                <div style={{ width: panelW, height: panelH }}>
                  <ExplainerPanel ranges={timeline.ranges} fontSize={c.panelFont} sections={sections} />
                </div>
              </div>
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
