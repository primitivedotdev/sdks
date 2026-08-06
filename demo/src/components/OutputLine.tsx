import { interpolate, useCurrentFrame } from "remotion";
import { f, monoFamily, toneColor } from "../theme";
import type { OutLineV } from "../timeline";

// Renders one pre-authored output line, fading/sliding in at its start frame.
export const OutputLine: React.FC<{ line: OutLineV; fontSize: number }> = ({ line, fontSize }) => {
  const frame = useCurrentFrame();
  const elapsed = frame - line.start;
  const opacity = interpolate(elapsed, [0, f(8)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dy = interpolate(elapsed, [0, f(8)], [6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const indent = " ".repeat(line.line.indent ?? 0);

  return (
    <div
      style={{
        fontFamily: monoFamily,
        fontSize,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        color: toneColor(line.line.tone),
        opacity,
        transform: `translateY(${dy}px)`,
        minHeight: line.line.text === "" ? fontSize * 0.75 : undefined,
      }}
    >
      {indent}
      {line.line.text}
    </div>
  );
};
