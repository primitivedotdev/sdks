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

// Thread CPU time can be coarse. On the Linux CI runners it moves in whole
// scheduler ticks of about 4 ms, while sanitizing an ordinary 100 kB body
// takes less than one tick, so a single call often reads 0 ms and a
// comparison against ten times that fails. Each sample therefore repeats its
// subject until at least this much CPU time has passed and reports the mean
// per call, which keeps the tick error to a small fraction of the sample.
const MIN_SAMPLE_CPU_MS = 40;
// A clock that never advances would otherwise loop forever. Fail instead.
const MAX_CALLS_PER_SAMPLE = 100_000;

function sampleCpuMs(subject: () => unknown): number {
  const start = threadCpuMs();
  let calls = 0;
  let elapsed = 0;
  do {
    subject();
    calls++;
    elapsed = threadCpuMs() - start;
    if (calls >= MAX_CALLS_PER_SAMPLE && elapsed < MIN_SAMPLE_CPU_MS)
      throw new Error(
        `thread CPU time advanced only ${elapsed} ms over ${calls} calls: the clock is not usable for these timing tests`,
      );
  } while (elapsed < MIN_SAMPLE_CPU_MS);
  return elapsed / calls;
}

/**
 * Runs every subject `runs` times, one of each per round, and returns the
 * least CPU time (ms) one call of each took, in the order given. Each
 * measurement is the mean over enough calls to fill MIN_SAMPLE_CPU_MS.
 */
export function leastCpuMs(
  subjects: ReadonlyArray<() => unknown>,
  runs: number,
): number[] {
  const best = subjects.map(() => Number.POSITIVE_INFINITY);
  for (let round = 0; round < runs; round++) {
    for (const [i, subject] of subjects.entries()) {
      best[i] = Math.min(
        best[i] ?? Number.POSITIVE_INFINITY,
        sampleCpuMs(subject),
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
