import { AbsoluteFill, interpolate, Series, useCurrentFrame, useVideoConfig } from "remotion";
import { Session } from "./components/Session";
import { StepLabel } from "./components/StepLabel";
import { Terminal } from "./components/Terminal";
import { TitleCard } from "./components/TitleCard";
import { INTRO_FRAMES, OUTRO_FRAMES, Scanlines, SESSION_TAIL } from "./DemoVideo";
import { outroInstall, outroRepo } from "./script";
import { agentIntroTagline, agentIntroTitle, agentSections } from "./scriptAgent";
import { type Format, f, theme } from "./theme";
import { buildTimeline } from "./timeline";

const margins: Record<Format, number> = { landscape: 96, square: 52, vertical: 56 };
const cardScale: Record<Format, number> = { landscape: 1, square: 0.78, vertical: 0.95 };

export const agentSessionFrames = (): number => buildTimeline(agentSections).total + SESSION_TAIL;
export const agentTotalFrames = (): number => INTRO_FRAMES + agentSessionFrames() + OUTRO_FRAMES;

const FadeIn: React.FC<{ children: React.ReactNode; frames?: number }> = ({ children, frames = f(12) }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, frames], [0, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const DemoVideoAgent: React.FC<{ format: Format }> = ({ format }) => {
  const { width, height } = useVideoConfig();
  const timeline = buildTimeline(agentSections);
  const fontSize = format === "square" ? 25 : 29;
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
              <TitleCard wordmark={agentIntroTitle} primary={agentIntroTagline} scale={cardScale[format]} />
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>

        <Series.Sequence durationInFrames={agentSessionFrames()}>
          <FadeIn>
            <AbsoluteFill style={{ padding: margin, flexDirection: "column", alignItems: "stretch", gap }}>
              <div style={{ display: "flex", justifyContent: format === "vertical" ? "center" : "flex-start" }}>
                <StepLabel ranges={timeline.ranges} fontSize={labelSize} />
              </div>
              <Terminal width={termW} height={termH} title="you@laptop — ~ — zsh" bodyPadding={margin * 0.5}>
                <Session timeline={timeline} fontSize={fontSize} />
              </Terminal>
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>

        <Series.Sequence durationInFrames={OUTRO_FRAMES}>
          <FadeIn>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <TitleCard wordmark={agentIntroTitle} primary={outroInstall} secondary={outroRepo} scale={cardScale[format]} mono />
            </AbsoluteFill>
          </FadeIn>
        </Series.Sequence>
      </Series>
      <Scanlines />
    </AbsoluteFill>
  );
};
