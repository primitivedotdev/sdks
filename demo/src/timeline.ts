import { FPS, f } from "./theme";
import { type Entry, type OutLine, type Section, type Tone, sections } from "./script";

// Baseline (30fps) frame counts; converted to the render rate via f() at use.
const DEFAULT_CPS = 26;
const DEFAULT_HOLD = 10;
const DEFAULT_PERLINE = 6;
const BLANK_FRAMES = 7;

export interface CmdLine {
  kind: "cmd";
  start: number;
  typeDuration: number;
  endHold: number;
  prefix: string;
  prefixTone: Tone;
  text: string;
  sectionId: string;
}

export interface OutLineV {
  kind: "out";
  start: number;
  line: OutLine;
  sectionId: string;
}

export interface BlankLine {
  kind: "blank";
  start: number;
  sectionId: string;
}

export type VLine = CmdLine | OutLineV | BlankLine;

export interface SectionRange {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface Timeline {
  lines: VLine[];
  ranges: SectionRange[];
  total: number;
}

function typeFrames(text: string, cps: number): number {
  // cps is chars/second, so this is already real-time-correct at any FPS.
  return Math.max(f(6), Math.ceil((text.length / cps) * FPS));
}

export interface TimelineOptions {
  // Multiplier applied to every hold/pause (1 = authored pacing, >1 = slower).
  holdScale?: number;
  // Idle pause (30fps-baseline frames) inserted at the start of each section,
  // before its first entry — gives the viewer time to read the explainer.
  leadInFrames?: number;
  // Extra dwell (30fps-baseline frames) held at the END of each section, with
  // the finished output still on screen, before the next section begins.
  sectionEndHoldFrames?: number;
  // Pad each section to this many FINAL frames so every step takes equal
  // wall-time (even distribution). The slack is held at the end (content on
  // screen). Sections naturally longer than this are left as-is.
  equalizeSectionFinalFrames?: number;
}

export function buildTimeline(secs: Section[] = sections, opts: TimelineOptions = {}): Timeline {
  const holdScale = opts.holdScale ?? 1;
  const leadIn = f(opts.leadInFrames ?? 0);
  const sectionEndHold = f(opts.sectionEndHoldFrames ?? 0);
  const scaleHold = (baseline: number) => f(Math.round(baseline * holdScale));

  const lines: VLine[] = [];
  const ranges: SectionRange[] = [];
  let cursor = 0;

  for (const section of secs) {
    const sectionStart = cursor;
    // Lead-in pause: terminal sits idle while the explainer panel is read.
    cursor += leadIn;
    for (const entry of section.entries as Entry[]) {
      if (entry.kind === "blank") {
        lines.push({ kind: "blank", start: cursor, sectionId: section.id });
        cursor += f(BLANK_FRAMES);
        continue;
      }
      if (entry.kind === "command") {
        const cps = entry.cps ?? DEFAULT_CPS;
        const dur = typeFrames(entry.text, cps);
        const endHold = scaleHold(entry.hold ?? DEFAULT_HOLD);
        lines.push({
          kind: "cmd",
          start: cursor,
          typeDuration: dur,
          endHold,
          prefix: entry.prefix ?? "$ ",
          prefixTone: entry.prefixTone ?? "accent",
          text: entry.text,
          sectionId: section.id,
        });
        cursor += dur + endHold;
        continue;
      }
      // output
      const perLine = f(entry.perLine ?? DEFAULT_PERLINE);
      entry.lines.forEach((line, i) => {
        lines.push({ kind: "out", start: cursor + i * perLine, line, sectionId: section.id });
      });
      cursor += entry.lines.length * perLine + scaleHold(entry.hold ?? DEFAULT_HOLD);
    }
    // Hold the finished step on screen before clearing to the next.
    cursor += sectionEndHold;
    // Equalize step wall-time: pad to the target so every step is the same
    // length (slack held at the end, content on screen).
    const equalizeTo = opts.equalizeSectionFinalFrames;
    if (equalizeTo && cursor - sectionStart < equalizeTo) {
      cursor = sectionStart + equalizeTo;
    }
    ranges.push({ id: section.id, label: section.label, start: sectionStart, end: cursor });
  }

  return { lines, ranges, total: cursor };
}
