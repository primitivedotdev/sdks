// Strip terminal control sequences (ANSI CSI/OSC escapes, other C0 and
// C1 controls) from sender-supplied text before printing it, keeping
// newlines and tabs. Email content must not be able to rewrite the
// terminal an operator or agent is reading.
export function sanitizeForTerminal(value: string): string {
  const ESC = 0x1b;
  const BEL = 0x07;
  let out = "";
  let i = 0;
  while (i < value.length) {
    const code = value.charCodeAt(i);
    if (code === ESC) {
      const next = value.charCodeAt(i + 1);
      if (next === 0x5b) {
        // CSI: ESC [ params... final byte in 0x40-0x7e.
        i += 2;
        while (i < value.length) {
          const c = value.charCodeAt(i);
          i += 1;
          if (c >= 0x40 && c <= 0x7e) break;
        }
      } else if (next === 0x5d) {
        // OSC: ESC ] ... terminated by BEL or ESC \.
        i += 2;
        while (i < value.length) {
          const c = value.charCodeAt(i);
          if (c === BEL) {
            i += 1;
            break;
          }
          if (c === ESC && value.charCodeAt(i + 1) === 0x5c) {
            i += 2;
            break;
          }
          i += 1;
        }
      } else {
        i += 2;
      }
      continue;
    }
    const isControl =
      (code < 0x20 && code !== 0x0a && code !== 0x09) ||
      (code >= 0x7f && code <= 0x9f);
    if (!isControl) out += value[i];
    i += 1;
  }
  return out;
}

/** Marks that reorder text on screen, so "inv\u202egpj.exe" could show as "invexe.jpg". */
const BIDI_CONTROLS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
/** The longest a sender's subject or file name is shown in a report line. */
const SHOWN_TEXT_MAX = 100;

/**
 * Text from outside the CLI (a server string, or one another member wrote)
 * on one report line: no terminal control sequences or reordering marks,
 * whitespace collapsed, and uncut.
 */
export function shownLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return sanitizeForTerminal(value)
    .replace(BIDI_CONTROLS, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

/**
 * Text a sender wrote (a subject, an address, a file name), as a report
 * line shows it: shownLine, cut at SHOWN_TEXT_MAX.
 */
export function shownText(value: unknown): string {
  const line = shownLine(value);
  return line.length > SHOWN_TEXT_MAX
    ? `${line.slice(0, SHOWN_TEXT_MAX - 3)}...`
    : line;
}

/**
 * A report line the CLI built around server text: no terminal control
 * sequences or reordering marks, and on one line, with its indentation kept.
 */
export function terminalLine(line: string): string {
  return sanitizeForTerminal(line)
    .replace(BIDI_CONTROLS, "")
    .replaceAll(/[\r\n\t]+/g, " ");
}
