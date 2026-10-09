// Test-only timing for the tests that hold the sanitizer to linear time.
//
// Those tests compare how long two inputs take, so they need a clock that
// counts the work and not the machine. Wall time does not: on a loaded runner
// the scheduler can park the test thread for longer than the whole sanitize,
// and a fixed bound that holds on a quiet laptop fails there (a 50 ms bound
// failed at 54 to 61 ms on a CI runner collecting coverage). The CPU time of
// the test's own thread only advances while that thread runs, so contention
// from other processes largely drops out, while the work itself (and the
// garbage collection it causes on this thread) is still counted.
//
// The subjects are also run round robin, keeping the least time each took:
// whatever slowdown the machine still passes through, such as a busier memory
// bus or coverage counters, lands on every subject alike instead of on
// whichever one ran during it.

export function threadCpuMs(): number {
  // Without it the comparisons would have to fall back to a clock that loaded
  // runners break, so fail instead of measuring something else.
  if (typeof process.threadCpuUsage !== "function")
    throw new Error(
      "process.threadCpuUsage is unavailable: these timing tests need a Node version that has it",
    );
  const { user, system } = process.threadCpuUsage();
  return (user + system) / 1000;
}

/**
 * Runs every subject `runs` times, one of each per round, and returns the
 * least CPU time (ms) each one took, in the order given.
 */
export function leastCpuMs(
  subjects: ReadonlyArray<() => unknown>,
  runs: number,
): number[] {
  const best = subjects.map(() => Number.POSITIVE_INFINITY);
  for (let round = 0; round < runs; round++) {
    for (const [i, subject] of subjects.entries()) {
      const start = threadCpuMs();
      subject();
      best[i] = Math.min(
        best[i] ?? Number.POSITIVE_INFINITY,
        threadCpuMs() - start,
      );
    }
  }
  return best;
}

/**
 * An ordinary email body of exactly `size` characters: a small stylesheet
 * (one class used, one hiding rule unused) and paragraphs of plain text that
 * carry the class, so every element goes through the cascade once.
 */
export function ordinaryHtml(size: number): string {
  const head = "<style>.a{color:#333}.h{display:none}</style>";
  const para = '<p class="a">An ordinary paragraph of newsletter text.</p>';
  const body = para.repeat(
    Math.ceil(Math.max(0, size - head.length) / para.length),
  );
  return (head + body).slice(0, size);
}
