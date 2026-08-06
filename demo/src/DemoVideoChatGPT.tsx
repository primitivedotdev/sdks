import { AbsoluteFill, interpolate, Series, useCurrentFrame, useVideoConfig } from "remotion";
import { ChatGPTApp, type ChatFormat } from "./components/ChatGPTApp";
import { TitleCard } from "./components/TitleCard";
import { INTRO_FRAMES, OUTRO_FRAMES, Scanlines } from "./DemoVideo";
import {
  buildChatTimeline,
  chatGptIntroTagline,
  chatGptIntroTitle,
  chatGptOutroPrimary,
  chatGptOutroUrl,
} from "./scriptChatGPT";
import { type Format, f, theme } from "./theme";

const BODY_TAIL = f(22);
const cardScale: Record<Format, number> = { landscape: 1, square: 0.78, vertical: 0.95 };

const fmtConfig: Record<Format, ChatFormat> = {
  landscape: { colMax: 860, baseFont: 27, s: 1.42, widgetMax: 860, sidebar: true, pad: 40 },
  square: { colMax: 920, baseFont: 27, s: 1.46, widgetMax: 920, sidebar: false, pad: 36 },
  vertical: { colMax: 960, baseFont: 32, s: 1.62, widgetMax: 960, sidebar: false, pad: 40 },
};

export const chatBodySessionFrames = (): number => f(buildChatTimeline().total) + BODY_TAIL;
export const chatGptTotalFrames = (): number => INTRO_FRAMES + chatBodySessionFrames() + OUTRO_FRAMES;

const FadeIn: React.FC<{ children: React.ReactNode; frames?: number }> = ({ children, frames = f(12) }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, frames], [0, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const DemoVideoChatGPT: React.FC<{ format: Format }> = ({ format }) => {
  const { width, height } = useVideoConfig();
  const timeline = buildChatTimeline();
  const fmt = fmtConfig[format];

  return (
    <AbsoluteFill style={{ backgroundColor: theme.pageBg }}>
      <Series>
        <Series.Sequence durationInFrames={INTRO_FRAMES}>
          <FadeIn>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <TitleCard wordmark={chatGptIntroTitle} primary={chatGptIntroTagline} scale={cardScale[format]} taglineLower />
            </AbsoluteFill>
            <Scanlines />
          </FadeIn>
        </Series.Sequence>

        <Series.Sequence durationInFrames={chatBodySessionFrames()}>
          <FadeIn>
            <ChatGPTApp steps={timeline.steps} fmt={fmt} width={width} height={height} />
          </FadeIn>
        </Series.Sequence>

        <Series.Sequence durationInFrames={OUTRO_FRAMES}>
          <FadeIn>
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
              <TitleCard
                wordmark={chatGptIntroTitle}
                primary={chatGptOutroPrimary}
                chip={chatGptOutroUrl}
                scale={cardScale[format]}
                taglineLower
              />
            </AbsoluteFill>
            <Scanlines />
          </FadeIn>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
