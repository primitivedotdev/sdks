import { useCurrentFrame } from "remotion";
import { f, theme } from "../theme";

// A blinking block cursor. `solid` keeps it fully on (used while typing).
export const Cursor: React.FC<{ fontSize: number; solid?: boolean }> = ({ fontSize, solid }) => {
  const frame = useCurrentFrame();
  const on = solid ? true : Math.floor(frame / f(16)) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: fontSize * 0.55,
        height: fontSize,
        marginLeft: 2,
        verticalAlign: "text-bottom",
        backgroundColor: theme.cursor,
        opacity: on ? 1 : 0,
        borderRadius: 2,
      }}
    />
  );
};
