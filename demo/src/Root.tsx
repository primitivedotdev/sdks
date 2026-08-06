import { Composition } from "remotion";
import { DemoVideo, totalFrames } from "./DemoVideo";
import { DemoVideoAgent, agentTotalFrames } from "./DemoVideoAgent";
import { DemoVideoAgentSignup, agentSignupTotalFrames } from "./DemoVideoAgentSignup";
import { DemoVideoChatGPT, chatGptTotalFrames } from "./DemoVideoChatGPT";
import { DemoVideoCombined, combinedTotalFrames, combinedTotalFramesNoBench } from "./DemoVideoCombined";
import { DemoVideoCombinedSegment, type SegmentKind, segmentFrames } from "./DemoVideoCombinedSegment";
import { DemoVideoExplained, explainedTotalFrames } from "./DemoVideoExplained";
import { DemoVideoNetwork, networkTotalFrames } from "./DemoVideoNetwork";
import { DemoVideoX402, x402TotalFrames } from "./DemoVideoX402";
import { FPS } from "./theme";

export const Root: React.FC = () => {
  const duration = totalFrames();
  const explainedDuration = explainedTotalFrames();
  const agentDuration = agentTotalFrames();
  const networkDuration = networkTotalFrames();
  const agentSignupDuration = agentSignupTotalFrames();
  const x402Duration = x402TotalFrames();
  const chatGptDuration = chatGptTotalFrames();
  const combinedDuration = combinedTotalFrames();
  const combinedDurationNoBench = combinedTotalFramesNoBench();
  return (
    <>
      <Composition
        id="Demo-Landscape"
        component={DemoVideo}
        durationInFrames={duration}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: "landscape" as const }}
      />
      <Composition
        id="Demo-Square"
        component={DemoVideo}
        durationInFrames={duration}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ format: "square" as const }}
      />
      <Composition
        id="Demo-Vertical"
        component={DemoVideo}
        durationInFrames={duration}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ format: "vertical" as const }}
      />
      <Composition
        id="Demo-Gif"
        component={DemoVideo}
        durationInFrames={duration}
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={{ format: "landscape" as const }}
      />

      {/* Narrated cut (slower + explainer side panel) for non-technical viewers. */}
      <Composition
        id="Explained-Landscape"
        component={DemoVideoExplained}
        durationInFrames={explainedDuration}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: "landscape" as const }}
      />
      <Composition
        id="Explained-Square"
        component={DemoVideoExplained}
        durationInFrames={explainedDuration}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ format: "square" as const }}
      />
      <Composition
        id="Explained-Vertical"
        component={DemoVideoExplained}
        durationInFrames={explainedDuration}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ format: "vertical" as const }}
      />

      {/* Storyline 2: give your agent email (Claude Code MCP → build → deploy → chat). */}
      <Composition
        id="Agent-Landscape"
        component={DemoVideoAgent}
        durationInFrames={agentDuration}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: "landscape" as const }}
      />
      <Composition
        id="Agent-Square"
        component={DemoVideoAgent}
        durationInFrames={agentDuration}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ format: "square" as const }}
      />
      <Composition
        id="Agent-Vertical"
        component={DemoVideoAgent}
        durationInFrames={agentDuration}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ format: "vertical" as const }}
      />

      {/* Storyline 3 (minimal): get any agent on the network — one CLI signup. */}
      <Composition
        id="Network-Landscape"
        component={DemoVideoNetwork}
        durationInFrames={networkDuration}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: "landscape" as const }}
      />
      <Composition
        id="Network-Square"
        component={DemoVideoNetwork}
        durationInFrames={networkDuration}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ format: "square" as const }}
      />
      <Composition
        id="Network-Vertical"
        component={DemoVideoNetwork}
        durationInFrames={networkDuration}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ format: "vertical" as const }}
      />

      {/* Explains the new agent signup flow: start → verify → live inbox.
          Logo bookends (3s each) captioned "agent signup". */}
      <Composition
        id="AgentSignup-Landscape"
        component={DemoVideoAgentSignup}
        durationInFrames={agentSignupDuration}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: "landscape" as const }}
      />
      <Composition
        id="AgentSignup-Square"
        component={DemoVideoAgentSignup}
        durationInFrames={agentSignupDuration}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ format: "square" as const }}
      />
      <Composition
        id="AgentSignup-Vertical"
        component={DemoVideoAgentSignup}
        durationInFrames={agentSignupDuration}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ format: "vertical" as const }}
      />

      {/* x402 agent-to-agent payments (launch-week-02): request → sign & settle →
          guardrails. Logo bookends captioned "agent payments". */}
      <Composition
        id="X402-Landscape"
        component={DemoVideoX402}
        durationInFrames={x402Duration}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: "landscape" as const }}
      />
      <Composition
        id="X402-Square"
        component={DemoVideoX402}
        durationInFrames={x402Duration}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ format: "square" as const }}
      />
      <Composition
        id="X402-Vertical"
        component={DemoVideoX402}
        durationInFrames={x402Duration}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ format: "vertical" as const }}
      />

      {/* Storyline: Primitive inside a ChatGPT App (Apps SDK). The connector
          runs in a mocked ChatGPT conversation and renders the real Primitive
          email-console widget inline. ~22s. */}
      <Composition
        id="ChatGPT-Landscape"
        component={DemoVideoChatGPT}
        durationInFrames={chatGptDuration}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: "landscape" as const }}
      />
      <Composition
        id="ChatGPT-Square"
        component={DemoVideoChatGPT}
        durationInFrames={chatGptDuration}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ format: "square" as const }}
      />
      <Composition
        id="ChatGPT-Vertical"
        component={DemoVideoChatGPT}
        durationInFrames={chatGptDuration}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ format: "vertical" as const }}
      />

      {/* Combined demo: signup → deploy function → add skill → chat with it (explained, ~60s). */}
      <Composition
        id="Combined-Landscape"
        component={DemoVideoCombined}
        durationInFrames={combinedDuration}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: "landscape" as const }}
      />
      <Composition
        id="Combined-Square"
        component={DemoVideoCombined}
        durationInFrames={combinedDuration}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ format: "square" as const }}
      />
      <Composition
        id="Combined-Vertical"
        component={DemoVideoCombined}
        durationInFrames={combinedDuration}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ format: "vertical" as const }}
      />

      {/* Combined demo without the closing benchmarks slide. */}
      <Composition
        id="Combined-NoBench-Landscape"
        component={DemoVideoCombined}
        durationInFrames={combinedDurationNoBench}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ format: "landscape" as const, showBenchmarks: false }}
      />
      <Composition
        id="Combined-NoBench-Square"
        component={DemoVideoCombined}
        durationInFrames={combinedDurationNoBench}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ format: "square" as const, showBenchmarks: false }}
      />
      <Composition
        id="Combined-NoBench-Vertical"
        component={DemoVideoCombined}
        durationInFrames={combinedDurationNoBench}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ format: "vertical" as const, showBenchmarks: false }}
      />

      {/* Combined demo split into 5 standalone clips (intro · steps · benchmarks). */}
      {(["intro", "step1", "step2", "step3", "benchmarks"] as SegmentKind[]).map((kind) => (
        <Composition
          key={kind}
          id={`Combined-${kind.charAt(0).toUpperCase()}${kind.slice(1)}`}
          component={DemoVideoCombinedSegment}
          durationInFrames={segmentFrames(kind)}
          fps={FPS}
          width={1920}
          height={1080}
          defaultProps={{ format: "landscape" as const, kind }}
        />
      ))}
    </>
  );
};
