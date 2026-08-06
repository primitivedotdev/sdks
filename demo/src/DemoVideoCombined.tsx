import { AbsoluteFill, interpolate, Series, useCurrentFrame, useVideoConfig } from "remotion";
import { BenchmarksSlide } from "./components/BenchmarksSlide";
import { ExplainerPanel } from "./components/ExplainerPanel";
import { Session } from "./components/Session";
import { StepLabel } from "./components/StepLabel";
import { Terminal } from "./components/Terminal";
import { TitleCard } from "./components/TitleCard";
import { INTRO_FRAMES, Scanlines, SESSION_TAIL } from "./DemoVideo";
import { combinedIntroTagline, combinedIntroTitle, combinedSections } from "./scriptCombined";
import { type Format, f, theme } from "./theme";
import { buildTimeline } from "./timeline";

// Combined demo (4 phases), explained side panel, paced to ~60s, closing on a
// benchmarks slide.
// clearPerSection gives each phase a fresh screen, so the lead-in is just a
// brief beat (not a long blank). Dwell time lives in holdScale (content on
// screen), not blank lead-ins.
// clearPerSection gives each phase a fresh screen. Snappy start (~0.5s, no
// sitting still), +2s end-dwell per step, and time spread evenly across each
// step's pauses (holdScale) rather than lumped. Benchmark slide is a fixed 10s.
export const COMBINED_INTRO_FRAMES = INTRO_FRAMES + f(120); // +4s on the "primitive" start screen
export const BENCH_FRAMES = f(420); // 14s benchmark slide
export const OUTRO_FRAMES = f(120); // 4s return to the opening logo
export const SLOW = { holdScale: 3.5, leadInFrames: 15, sectionEndHoldFrames: 60 };

export const combinedSessionFrames = (): number => buildTimeline(combinedSections, SLOW).total + SESSION_TAIL;
export const combinedTotalFrames = (): number => COMBINED_INTRO_FRAMES + combinedSessionFrames() + BENCH_FRAMES;
export const combinedTotalFramesNoBench = (): number => COMBINED_INTRO_FRAMES + combinedSessionFrames() + OUTRO_FRAMES;

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
  landscape: { margin: 80, gap: 40, row: true, fontSize: 27, panelFont: 32, labelSize: 22 },
  square: { margin: 44, gap: 26, row: false, fontSize: 22, panelFont: 24, labelSize: 18 },
  vertical: { margin: 48, gap: 32, row: false, fontSize: 29, panelFont: 34, labelSize: 23 },
};

const FadeIn: React.FC<{ children: React.ReactNode; frames?: number }> = ({ children, frames = f(12) }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, frames], [0, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const DemoVideoCombined: React.FC<{ format: Format; showBenchmarks?: boolean }> = ({ format, showBenchmarks = true }) => {
  const { width, height } = useVideoConfig();
  const timeline = buildTimeline(combinedSections, SLOW);
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
        <Series.Sequence durationInFrames={COMBINED_INTRO_FRAMES}>
          <FadeIn>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <TitleCard wordmark={combinedIntroTitle} primary={combinedIntroTagline} scale={cardScale[format] * 1.3} taglineLower />
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>

        <Series.Sequence durationInFrames={combinedSessionFrames()}>
          <FadeIn>
            <AbsoluteFill style={{ padding: c.margin, flexDirection: "column", gap: c.gap }}>
              <div style={{ display: "flex", justifyContent: c.row ? "flex-start" : "center" }}>
                <StepLabel ranges={timeline.ranges} fontSize={c.labelSize} lowercase />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: c.row ? "row" : "column", gap: c.gap, minHeight: 0 }}>
                <Terminal width={termW} height={termH} title="you@laptop — ~ — zsh" bodyPadding={Math.round(c.fontSize * 1.3)} anchorTop>
                  <Session timeline={timeline} fontSize={c.fontSize} clearPerSection />
                </Terminal>
                <div style={{ width: panelW, height: panelH }}>
                  <ExplainerPanel ranges={timeline.ranges} fontSize={c.panelFont} sections={combinedSections} lowercase />
                </div>
              </div>
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>

        {showBenchmarks ? (
          <Series.Sequence durationInFrames={BENCH_FRAMES}>
            <FadeIn>
              <BenchmarksSlide format={format} />
            </FadeIn>
          </Series.Sequence>
        ) : (
          <Series.Sequence durationInFrames={OUTRO_FRAMES}>
            <FadeIn>
              <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                <TitleCard wordmark={combinedIntroTitle} primary={combinedIntroTagline} scale={cardScale[format] * 1.3} taglineLower />
              </AbsoluteFill>
            </FadeIn>
          </Series.Sequence>
        )}
      </Series>
      <Scanlines />
    </AbsoluteFill>
  );
};
