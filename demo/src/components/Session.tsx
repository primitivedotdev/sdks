import { useCurrentFrame } from "remotion";
import type { Timeline } from "../timeline";
import { OutputLine } from "./OutputLine";
import { TypedLine } from "./TypedLine";

// Renders the terminal scrollback: every line whose start frame has passed,
// in order. The most recently started line owns the cursor while it is a
// command (typing or holding before its output appears).
//
// clearPerSection: render only the CURRENT section's lines, so the screen
// "refreshes" at each phase boundary instead of accumulating scrollback.
export const Session: React.FC<{ timeline: Timeline; fontSize: number; clearPerSection?: boolean }> = ({
  timeline,
  fontSize,
  clearPerSection,
}) => {
  const frame = useCurrentFrame();

  let lines = timeline.lines;
  if (clearPerSection) {
    const cur =
      timeline.ranges.find((r) => frame >= r.start && frame < r.end) ?? timeline.ranges[timeline.ranges.length - 1];
    lines = timeline.lines.filter((l) => l.sectionId === cur.id);
  }

  let cursorOwner = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].start <= frame) cursorOwner = i;
  }
  if (cursorOwner >= 0 && lines[cursorOwner].kind !== "cmd") cursorOwner = -1;

  return (
    <>
      {lines.map((line, i) => {
        if (line.start > frame) return null;
        const key = `${line.sectionId}-${line.kind}-${i}`;
        if (line.kind === "cmd") {
          return <TypedLine key={key} line={line} fontSize={fontSize} cursorActive={i === cursorOwner} />;
        }
        if (line.kind === "out") {
          return <OutputLine key={key} line={line} fontSize={fontSize} />;
        }
        return <div key={key} style={{ height: fontSize * 0.75 }} />;
      })}
    </>
  );
};
