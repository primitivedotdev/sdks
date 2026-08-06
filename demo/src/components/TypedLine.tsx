import { useCurrentFrame } from "remotion";
import { monoFamily, toneColor } from "../theme";
import type { CmdLine } from "../timeline";
import { Cursor } from "./Cursor";

// Renders one command line, typing the text character-by-character.
// Shows a solid cursor while typing and a blinking cursor during the hold.
export const TypedLine: React.FC<{ line: CmdLine; fontSize: number; cursorActive: boolean }> = ({
  line,
  fontSize,
  cursorActive,
}) => {
  const frame = useCurrentFrame();
  const elapsed = frame - line.start;
  const progress = Math.min(1, Math.max(0, elapsed / line.typeDuration));
  const shown = Math.round(progress * line.text.length);
  const typing = elapsed < line.typeDuration;

  return (
    <div
      style={{
        fontFamily: monoFamily,
        fontSize,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        color: toneColor("default"),
      }}
    >
      <span style={{ color: toneColor(line.prefixTone) }}>{line.prefix}</span>
      <span style={{ color: toneColor("default") }}>{line.text.slice(0, shown)}</span>
      {cursorActive ? <Cursor fontSize={fontSize} solid={typing} /> : null}
    </div>
  );
};
