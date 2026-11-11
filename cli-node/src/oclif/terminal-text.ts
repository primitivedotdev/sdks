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
