import { Fragment } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { monoFamily } from "../theme";
import type { WidgetEmail, WidgetPayload } from "../scriptChatGPT";

// Pixel-faithful re-render of the live Primitive email-console widget
// (ui://widget/primitive-email-v1.html) in its DARK theme — the exact card a
// user sees inline in ChatGPT. Every token, label, and layout rule mirrors the
// widget's own CSS + render() (header + status badge, metrics grid, "Messages"
// list / "Summary" key-values, "Raw result" disclosure). `s` scales the
// widget's native CSS px up to the video's resolution.

// Dark brand tokens (the widget's :root[data-theme="dark"]).
const D = {
  bg: "#1d1d1d",
  fg: "#f4f4f4",
  muted: "#9a9a9a",
  border: "#f4f4f4",
  badgeBg: "#181818",
  badgeFg: "#f4f4f4",
  okBg: "#14532d",
  okFg: "#bbf7d0",
  codeBg: "#181818",
} as const;

const toolTitles: Record<string, string> = {
  getAccount: "Account",
  getInboxStatus: "Inbox status",
  listEmails: "Inbound emails",
  searchEmails: "Email search",
  getEmail: "Email details",
  replyToEmail: "Reply sent",
  sendEmail: "Email sent",
};

function isArray(d: WidgetPayload["data"]): d is WidgetEmail[] {
  return Array.isArray(d);
}

const Metric: React.FC<{ label: string; value: string; s: number }> = ({ label, value, s }) => (
  <div style={{ border: `${s}px solid ${D.border}`, background: D.bg, padding: 10 * s }}>
    <div
      style={{
        color: D.muted,
        fontSize: 10 * s,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        lineHeight: 1.3,
      }}
    >
      {label}
    </div>
    <div style={{ marginTop: 4 * s, color: D.fg, fontSize: 13 * s, fontWeight: 650, lineHeight: 1.35 }}>{value}</div>
  </div>
);

export const EmailWidget: React.FC<{ payload: WidgetPayload; s: number; appearAt: number }> = ({
  payload,
  s,
  appearAt,
}) => {
  const frame = useCurrentFrame();
  const since = frame - appearAt;
  const opacity = interpolate(since, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dy = interpolate(since, [0, 18], [18 * s, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const title = toolTitles[payload.tool] ?? "Primitive result";
  const statusText = `HTTP ${payload.status}`;

  // renderMetrics, faithful to the widget.
  const arr = isArray(payload.data) ? payload.data : null;
  const obj = isArray(payload.data) ? null : payload.data;
  const metrics: [string, string][] = [
    ["Tool", title],
    ["Status", String(payload.status)],
  ];
  if (arr) metrics.push(["Items", String(arr.length)]);
  if (obj?.id) metrics.push(["ID", obj.id]);
  if (obj?.status) metrics.push(["Record status", obj.status]);

  // Summary key-values (scalar entries of an object payload).
  const summary = obj ? Object.entries(obj).slice(0, 8) : [];

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${dy}px)`,
        // The host (ChatGPT) frames app widgets with a rounded 1px border;
        // the widget's own sharp brutalist surfaces sit inside that clip.
        borderRadius: 16 * s,
        overflow: "hidden",
        border: `${s}px solid rgba(255,255,255,0.10)`,
        background: D.bg,
        width: "100%",
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          fontFamily: monoFamily,
          background: D.bg,
          padding: 14 * s,
          display: "grid",
          gap: 12 * s,
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12 * s,
            paddingBottom: 12 * s,
            borderBottom: `${s}px solid ${D.border}`,
          }}
        >
          <div>
            <div style={{ color: D.fg, fontSize: 15 * s, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.25 }}>
              {title}
            </div>
            <div style={{ color: D.muted, fontSize: 12 * s, marginTop: 3 * s, lineHeight: 1.4 }}>
              Latest Primitive MCP result
            </div>
          </div>
          <div
            style={{
              flex: "0 0 auto",
              border: `${s}px solid ${D.border}`,
              padding: `${4 * s}px ${8 * s}px`,
              color: D.okFg,
              background: D.okBg,
              fontSize: 12 * s,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {statusText}
          </div>
        </div>

        {/* metrics grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(${136 * s}px, 1fr))`,
            gap: 8 * s,
          }}
        >
          {metrics.map(([label, value]) => (
            <Metric key={label} label={label} value={value} s={s} />
          ))}
        </div>

        {/* Messages list (array payload) */}
        {arr ? (
          <div style={{ border: `${s}px solid ${D.border}`, background: D.bg, padding: 10 * s }}>
            <div style={{ color: D.fg, fontSize: 12 * s, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 8 * s }}>
              Messages
            </div>
            <div style={{ display: "grid", gap: 8 * s }}>
              {arr.slice(0, 6).map((email, i) => {
                const meta = [email.from_email && `From ${email.from_email}`, email.to_email && `To ${email.to_email}`, email.status]
                  .filter(Boolean)
                  .join(" | ");
                const rowOpacity = interpolate(since, [10 + i * 6, 22 + i * 6], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                return (
                  <div key={i} style={{ border: `${s}px solid ${D.border}`, background: D.bg, padding: 9 * s, opacity: rowOpacity }}>
                    <div style={{ color: D.fg, fontSize: 13 * s, lineHeight: 1.35 }}>{email.subject}</div>
                    <div style={{ color: D.muted, fontSize: 12 * s, marginTop: 3 * s, lineHeight: 1.35 }}>{meta}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Summary key-values (object payload) */}
        {summary.length ? (
          <div style={{ border: `${s}px solid ${D.border}`, background: D.bg, padding: 10 * s }}>
            <div style={{ color: D.fg, fontSize: 12 * s, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 8 * s }}>
              Summary
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `minmax(${92 * s}px, 0.34fr) 1fr`,
                gap: `${7 * s}px ${10 * s}px`,
              }}
            >
              {summary.map(([k, v]) => (
                <Fragment key={k}>
                  <div style={{ color: D.muted, fontSize: 12 * s, lineHeight: 1.35 }}>{k}</div>
                  <div style={{ color: D.fg, fontSize: 12 * s, fontWeight: 600, lineHeight: 1.35 }}>{v}</div>
                </Fragment>
              ))}
            </div>
          </div>
        ) : null}

        {/* Raw result disclosure (collapsed, as the widget ships it) */}
        <div style={{ border: `${s}px solid ${D.border}`, background: D.bg, padding: 10 * s, display: "flex", alignItems: "center", gap: 8 * s }}>
          <span style={{ color: D.muted, fontSize: 11 * s }}>▸</span>
          <span style={{ color: D.fg, fontSize: 12 * s, fontWeight: 700, letterSpacing: "-0.01em" }}>Raw result</span>
        </div>
      </div>
    </div>
  );
};
