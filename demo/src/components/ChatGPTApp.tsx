import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { f, monoFamily, uiSansFamily } from "../theme";
import { type Step, type TimedStep } from "../scriptChatGPT";
import { EmailWidget } from "./EmailWidget";

// A mocked ChatGPT (Apps SDK host) conversation, matched to the real product:
// pure-black canvas, a collapsed icon rail, the ChatGPT⌄ / Upgrade top bar, and
// the pill composer (+ · Ask anything · mic · voice). The host chrome is Inter;
// the inline result card is the genuine Primitive email-console widget.

// ChatGPT dark chrome tokens (matched to the live app).
const C = {
  bg: "#000000",
  userBubble: "#303030",
  text: "#ececec",
  muted: "#b4b4b4",
  faint: "#8e8e8e",
  hair: "rgba(255,255,255,0.10)",
  railIcon: "#c4c4c4",
  composer: "#2f2f2f",
  chipBg: "#1e1e1e",
  upgradeBlue: "#7aa2ff",
  avatarTeal: "#0f9d77",
} as const;

export interface ChatFormat {
  colMax: number;
  baseFont: number;
  s: number; // EmailWidget scale
  widgetMax: number;
  sidebar: boolean; // show the icon rail (desktop) vs. mobile top bar
  pad: number;
}

// Official OpenAI logomark (simple-icons, viewBox 0 0 24 24).
const OPENAI_PATH =
  "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z";

const OpenAIMark: React.FC<{ size: number; color?: string }> = ({ size, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "0 0 auto", display: "block" }}>
    <path d={OPENAI_PATH} fill={color} />
  </svg>
);

// Generic stroked icon wrapper.
const Ico: React.FC<{ size: number; color?: string; children: React.ReactNode; fill?: boolean }> = ({
  size,
  color = C.railIcon,
  children,
  fill,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill ? color : "none"}
    stroke={fill ? "none" : color}
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block", flex: "0 0 auto" }}
  >
    {children}
  </svg>
);

const IconNewChat: React.FC<{ size: number; color?: string }> = ({ size, color }) => (
  <Ico size={size} color={color}>
    <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
  </Ico>
);
const IconSearch: React.FC<{ size: number; color?: string }> = ({ size, color }) => (
  <Ico size={size} color={color}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Ico>
);
const IconBubble: React.FC<{ size: number; color?: string }> = ({ size, color }) => (
  <Ico size={size} color={color}>
    <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Ico>
);
const IconShare: React.FC<{ size: number; color?: string }> = ({ size, color }) => (
  <Ico size={size} color={color}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.2 20c0-3.4 2.6-6 5.8-6 1.6 0 3 .6 4 1.7" />
    <path d="M18 7.5v6M21 10.5h-6" />
  </Ico>
);
const IconDashedCircle: React.FC<{ size: number; color?: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? C.railIcon} strokeWidth={1.9} strokeLinecap="round" style={{ display: "block", flex: "0 0 auto" }}>
    <circle cx="12" cy="12" r="9" strokeDasharray="2.6 3.4" />
  </svg>
);
const IconPlus: React.FC<{ size: number; color?: string }> = ({ size, color }) => (
  <Ico size={size} color={color}>
    <path d="M12 5v14M5 12h14" />
  </Ico>
);
const IconMic: React.FC<{ size: number; color?: string }> = ({ size, color }) => (
  <Ico size={size} color={color}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Ico>
);
const IconArrowUp: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <Ico size={size} color={color}>
    <path d="M12 19V6M6 12l6-6 6 6" />
  </Ico>
);
const IconSparkle: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flex: "0 0 auto" }}>
    <path d="M12 2.5l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z" fill={color} />
  </svg>
);
// Voice/dictation waveform inside the white circle.
const Waveform: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  const bars = [0.34, 0.62, 1, 0.62, 0.34];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
      {bars.map((h, i) => {
        const x = 5 + i * 3.5;
        const bh = 12 * h;
        return <rect key={i} x={x} y={12 - bh / 2} width={2} height={bh} rx={1} fill={color} />;
      })}
    </svg>
  );
};

// The real Primitive app icon (green ammonite on black), rounded like an app tile.
const PrimitiveMark: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.26, overflow: "hidden", flex: "0 0 auto", background: "#000" }}>
    <Img src={staticFile("primitive-logo.svg")} style={{ width: "100%", height: "100%", display: "block" }} />
  </div>
);

const TypingDots: React.FC<{ color: string; size: number }> = ({ color, size }) => {
  const frame = useCurrentFrame();
  return (
    <span style={{ display: "inline-flex", gap: size * 0.35, alignItems: "center" }}>
      {[0, 1, 2].map((i) => {
        const phase = (frame / f(18) + i / 3) % 1;
        const o = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2));
        return <span key={i} style={{ width: size, height: size, borderRadius: "50%", background: color, opacity: o }} />;
      })}
    </span>
  );
};

// The "Used Primitive" tool row + result card: a live "Working" state that
// resolves into a pill, then reveals the email-console widget below it.
const ToolBlock: React.FC<{ ts: TimedStep; fmt: ChatFormat }> = ({ ts, fmt }) => {
  const frame = useCurrentFrame();
  const step = ts.step as Extract<Step, { kind: "tool" }>;
  const resolved = frame >= f(ts.resolveAt ?? 0);
  const showWidget = frame >= f(ts.widgetAt ?? 0);
  const fs = fmt.baseFont * 0.66;
  const enter = interpolate(frame - f(ts.workingAt ?? 0), [0, f(8)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: fmt.baseFont * 0.7, minWidth: 0 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: fs * 0.6,
          alignSelf: "flex-start",
          padding: `${fs * 0.5}px ${fs * 0.75}px`,
          borderRadius: 999,
          background: C.chipBg,
          border: `1px solid ${C.hair}`,
          opacity: enter,
          fontFamily: uiSansFamily,
          fontSize: fs,
        }}
      >
        <PrimitiveMark size={fs * 1.3} />
        {resolved ? (
          <>
            <span style={{ color: C.muted }}>Used</span>
            <span style={{ color: C.text, fontWeight: 600 }}>Primitive</span>
            <span style={{ color: C.faint, fontFamily: monoFamily, fontSize: fs * 0.92 }}>{step.tool}</span>
            <span style={{ color: "#3fd624", fontSize: fs * 1.05 }}>✓</span>
          </>
        ) : (
          <>
            <span style={{ color: C.muted }}>{step.working}</span>
            <TypingDots color={C.faint} size={fs * 0.3} />
          </>
        )}
      </div>
      {showWidget ? (
        <div style={{ width: "100%", maxWidth: fmt.widgetMax }}>
          <EmailWidget payload={step.payload} s={fmt.s} appearAt={f(ts.widgetAt ?? 0)} />
        </div>
      ) : null}
    </div>
  );
};

// Live "waiting for reply" beat — the tension before the inbound reply lands.
const WaitRow: React.FC<{ ts: TimedStep; fmt: ChatFormat }> = ({ ts, fmt }) => {
  const frame = useCurrentFrame();
  const step = ts.step as Extract<Step, { kind: "wait" }>;
  const fs = fmt.baseFont * 0.7;
  const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(((frame % f(50)) / f(50)) * Math.PI * 2));
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: fs * 0.6,
        alignSelf: "flex-start",
        padding: `${fs * 0.55}px ${fs * 0.8}px`,
        borderRadius: 999,
        background: C.chipBg,
        border: `1px solid ${C.hair}`,
        fontFamily: uiSansFamily,
        fontSize: fs,
      }}
    >
      <div style={{ opacity: pulse, display: "flex" }}>
        <PrimitiveMark size={fs * 1.3} />
      </div>
      <span style={{ color: C.muted }}>{step.label}</span>
      <TypingDots color={C.faint} size={fs * 0.32} />
    </div>
  );
};

const UserBubble: React.FC<{ ts: TimedStep; fmt: ChatFormat }> = ({ ts, fmt }) => {
  const frame = useCurrentFrame();
  const step = ts.step as Extract<Step, { kind: "user" }>;
  const since = frame - f(ts.sendAt ?? 0);
  const opacity = interpolate(since, [0, f(7)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dy = interpolate(since, [0, f(7)], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", opacity, transform: `translateY(${dy}px)` }}>
      <div
        style={{
          maxWidth: "75%",
          background: C.userBubble,
          color: C.text,
          fontFamily: uiSansFamily,
          fontSize: fmt.baseFont,
          lineHeight: 1.5,
          padding: `${fmt.baseFont * 0.62}px ${fmt.baseFont * 0.9}px`,
          borderRadius: fmt.baseFont * 1.05,
        }}
      >
        {step.text}
      </div>
    </div>
  );
};

const SayBlock: React.FC<{ ts: TimedStep; fmt: ChatFormat }> = ({ ts, fmt }) => {
  const frame = useCurrentFrame();
  const step = ts.step as Extract<Step, { kind: "say" }>;
  const shown = Math.round(
    interpolate(frame - f(ts.start), [0, f(ts.textDur ?? 1)], [0, step.text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const streaming = shown < step.text.length;
  return (
    <div style={{ fontFamily: uiSansFamily, fontSize: fmt.baseFont, lineHeight: 1.55, color: C.text }}>
      {step.text.slice(0, shown)}
      {streaming ? <span style={{ opacity: 0.7 }}>▍</span> : null}
    </div>
  );
};

const Composer: React.FC<{ text: string; typing: boolean; fmt: ChatFormat }> = ({ text, typing, fmt }) => {
  const frame = useCurrentFrame();
  const caretOn = Math.floor(frame / f(16)) % 2 === 0;
  const bf = fmt.baseFont;
  const hasText = text.length > 0;
  const btn = bf * 1.7;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: bf * 0.6,
        background: C.composer,
        borderRadius: 999,
        padding: `${bf * 0.62}px ${bf * 0.7}px ${bf * 0.62}px ${bf * 0.85}px`,
      }}
    >
      <IconPlus size={bf * 1.25} color={C.text} />
      <span style={{ fontFamily: uiSansFamily, fontSize: bf, color: hasText ? C.text : C.faint, lineHeight: 1.4, flex: 1, minWidth: 0 }}>
        {text || "Ask anything"}
        {typing && caretOn ? <span style={{ color: C.text }}>|</span> : null}
      </span>
      {hasText ? (
        <div style={{ width: btn, height: btn, borderRadius: "50%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
          <IconArrowUp size={bf * 1.05} color="#000000" />
        </div>
      ) : (
        <>
          <IconMic size={bf * 1.2} color={C.muted} />
          <div style={{ width: btn, height: btn, borderRadius: "50%", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
            <Waveform size={bf * 1.05} color="#000000" />
          </div>
        </>
      )}
    </div>
  );
};

// Collapsed desktop icon rail.
const IconRail: React.FC<{ fmt: ChatFormat; width: number }> = ({ fmt, width }) => {
  const icon = fmt.baseFont * 0.96;
  const railBtn = (node: React.ReactNode) => (
    <div style={{ width: icon * 1.9, height: icon * 1.9, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: fmt.baseFont * 0.45 }}>{node}</div>
  );
  return (
    <div
      style={{
        width,
        flex: "0 0 auto",
        background: C.bg,
        borderRight: `1px solid ${C.hair}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: `${fmt.baseFont * 0.9}px 0`,
        gap: fmt.baseFont * 0.35,
      }}
    >
      {railBtn(<OpenAIMark size={icon * 1.15} />)}
      <div style={{ height: fmt.baseFont * 0.6 }} />
      {railBtn(<IconNewChat size={icon} />)}
      {railBtn(<IconSearch size={icon} />)}
      {railBtn(<IconBubble size={icon} />)}
      <div style={{ flex: 1 }} />
      <div
        style={{
          width: icon * 1.6,
          height: icon * 1.6,
          borderRadius: "50%",
          background: C.avatarTeal,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: uiSansFamily,
          fontWeight: 600,
          fontSize: icon * 0.7,
          color: "#ffffff",
        }}
      >
        AP
      </div>
    </div>
  );
};

export const ChatGPTApp: React.FC<{
  steps: TimedStep[];
  fmt: ChatFormat;
  width: number;
  height: number;
}> = ({ steps, fmt, width, height }) => {
  const frame = useCurrentFrame();

  // Composer state: partial text while a user step is being typed, else empty.
  let composerText = "";
  let composerTyping = false;
  for (const ts of steps) {
    if (ts.step.kind !== "user") continue;
    if (frame >= f(ts.typeStart ?? 0) && frame < f(ts.sendAt ?? 0)) {
      const prog = interpolate(frame - f(ts.typeStart ?? 0), [0, f(ts.typeDur ?? 1)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      composerText = ts.step.text.slice(0, Math.round(prog * ts.step.text.length));
      composerTyping = true;
      break;
    }
  }

  const railW = Math.round(fmt.baseFont * 3.4);
  const bf = fmt.baseFont;

  // A user step appears in the scrollback only once sent; every other step
  // appears at its start frame.
  const visible = (ts: TimedStep) => (ts.step.kind === "user" ? frame >= f(ts.sendAt ?? 0) : frame >= f(ts.start));

  return (
    <div style={{ width, height, background: C.bg, display: "flex", overflow: "hidden" }}>
      {fmt.sidebar ? <IconRail fmt={fmt} width={railW} /> : null}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* top bar */}
        <div
          style={{
            height: bf * 2.6,
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${fmt.pad}px`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: bf * 0.35 }}>
            {!fmt.sidebar ? <OpenAIMark size={bf * 1.15} /> : null}
            <span style={{ fontFamily: uiSansFamily, fontSize: bf * 1.05, fontWeight: 700, color: C.text }}>ChatGPT</span>
            <span style={{ color: C.muted, fontSize: bf * 0.9 }}>⌄</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: bf * 0.95 }}>
            <span style={{ display: "flex", alignItems: "center", gap: bf * 0.28 }}>
              <IconSparkle size={bf * 0.95} color={C.upgradeBlue} />
              <span style={{ fontFamily: uiSansFamily, fontSize: bf * 0.92, color: "#cdd9ff" }}>Upgrade</span>
            </span>
            <IconShare size={bf * 1.05} color={C.text} />
            <IconDashedCircle size={bf * 1.05} color={C.text} />
          </div>
        </div>

        {/* conversation (bottom-anchored, newest in view) */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "center" }}>
          <div
            style={{
              width: "100%",
              maxWidth: fmt.colMax,
              padding: `${fmt.pad * 0.6}px ${fmt.pad}px`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: bf * 0.95,
            }}
          >
            {steps.map((ts, i) => {
              if (!visible(ts)) return null;
              if (ts.step.kind === "user") return <UserBubble key={i} ts={ts} fmt={fmt} />;
              if (ts.step.kind === "tool") return <ToolBlock key={i} ts={ts} fmt={fmt} />;
              if (ts.step.kind === "wait") return <WaitRow key={i} ts={ts} fmt={fmt} />;
              return <SayBlock key={i} ts={ts} fmt={fmt} />;
            })}
          </div>
        </div>

        {/* composer */}
        <div style={{ flex: "0 0 auto", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: fmt.colMax, padding: `${fmt.pad * 0.4}px ${fmt.pad}px ${fmt.pad * 0.7}px` }}>
            <Composer text={composerText} typing={composerTyping} fmt={fmt} />
          </div>
        </div>
      </div>
    </div>
  );
};
