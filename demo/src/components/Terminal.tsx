import { monoFamily, theme } from "../theme";

const Dot: React.FC<{ color: string }> = ({ color }) => (
  // Square dots to match the brutalist (no border-radius) brand.
  <div style={{ width: 14, height: 14, backgroundColor: color, border: `1px solid ${theme.baseLight}` }} />
);

// Brutalist terminal window: sharp corners, thick foreground border, hard
// offset shadow (no blur). Body is bottom-anchored so new lines push older
// ones up, like a real terminal.
export const Terminal: React.FC<{
  width: number;
  height: number;
  title: string;
  bodyPadding: number;
  children: React.ReactNode;
  // Anchor body content to the top (fresh-screen feel) instead of the bottom
  // (scrollback feel).
  anchorTop?: boolean;
}> = ({ width, height, title, bodyPadding, children, anchorTop }) => {
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: theme.windowBg,
        border: `2px solid ${theme.windowBorder}`,
        borderRadius: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: `10px 10px 0 0 ${theme.accentDeep}`,
      }}
    >
      <div
        style={{
          height: 52,
          flexShrink: 0,
          backgroundColor: theme.titlebarBg,
          display: "flex",
          alignItems: "center",
          paddingLeft: 18,
          gap: 10,
          position: "relative",
          borderBottom: `2px solid ${theme.windowBorder}`,
        }}
      >
        <Dot color={theme.dotRed} />
        <Dot color={theme.dotYellow} />
        <Dot color={theme.dotGreen} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: monoFamily,
            fontSize: 22,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: theme.titlebarText,
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          padding: bodyPadding,
          paddingTop: bodyPadding * 0.7,
          display: "flex",
          flexDirection: "column",
          justifyContent: anchorTop ? "flex-start" : "flex-end",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
};
