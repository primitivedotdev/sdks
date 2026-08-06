import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BenchmarksSlide } from "./components/BenchmarksSlide";
import { ExplainerPanel } from "./components/ExplainerPanel";
import { Session } from "./components/Session";
import { StepLabel } from "./components/StepLabel";
import { Terminal } from "./components/Terminal";
import { TitleCard } from "./components/TitleCard";
import { Scanlines } from "./DemoVideo";
import { BENCH_FRAMES, COMBINED_INTRO_FRAMES, SLOW } from "./DemoVideoCombined";
import { combinedIntroTagline, combinedIntroTitle, combinedSections } from "./scriptCombined";
import { type Format, f, theme } from "./theme";
import { buildTimeline } from "./timeline";

// The combined demo, split into standalone clips: the intro card, each step,
// and the benchmarks slide. Each renders identically to its slice of the full
// video, starting at frame 0.
export type SegmentKind = "intro" | "step1" | "step2" | "step3" | "benchmarks";

const STEP_INDEX: Record<string, number> = { step1: 0, step2: 1, step3: 2 };

export const segmentFrames = (kind: SegmentKind): number => {
  if (kind === "intro") return COMBINED_INTRO_FRAMES;
  if (kind === "benchmarks") return BENCH_FRAMES;
  return buildTimeline([combinedSections[STEP_INDEX[kind]]], SLOW).total;
};

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

const FadeIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, f(12)], [0, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const DemoVideoCombinedSegment: React.FC<{ format: Format; kind: SegmentKind }> = ({ format, kind }) => {
  const { width, height } = useVideoConfig();

  let inner: React.ReactNode;
  if (kind === "intro") {
    inner = (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <TitleCard wordmark={combinedIntroTitle} primary={combinedIntroTagline} scale={cardScale[format] * 1.3} taglineLower />
      </AbsoluteFill>
    );
  } else if (kind === "benchmarks") {
    inner = <BenchmarksSlide format={format} />;
  } else {
    const c = cfg[format];
    const timeline = buildTimeline([combinedSections[STEP_INDEX[kind]]], SLOW);
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
    inner = (
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
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: theme.pageBg }}>
      <FadeIn>{inner}</FadeIn>
      <Scanlines />
    </AbsoluteFill>
  );
};
