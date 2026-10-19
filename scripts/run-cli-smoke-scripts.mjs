#!/usr/bin/env node

/**
 * Run the packed-CLI smoke scripts concurrently.
 *
 * Usage:
 *   node scripts/run-cli-smoke-scripts.mjs <primitive-bin>
 *
 * Each smoke script starts its own fixture servers on port 0 and keeps its
 * state in its own mkdtemp directory, so they do not depend on each other.
 * To keep them from sharing anything through the environment, every script
 * also gets a private HOME, XDG_CONFIG_HOME and TMPDIR, and inherited
 * PRIMITIVE_* variables other than PRIMITIVE_SKIP_NEW_VERSION_CHECK are
 * dropped.
 *
 * Output is buffered per script and printed as one block when that script
 * finishes, so interleaved runs stay readable. The run ends with a summary
 * naming every script that failed, and exits 1 if any did.
 *
 * Concurrency defaults to twice the available CPUs (scripts spend much of
 * their time waiting on child processes and timers) and can be set with
 * CLI_SMOKE_CONCURRENCY. CLI_SMOKE_CONCURRENCY=1 runs them one at a time.
 * A script still running after CLI_SMOKE_TIMEOUT_MS (default 300000) is
 * killed and reported as failed.
 *
 * Every scripts/smoke-*.mjs file must be listed in SMOKES below, so a new
 * smoke script cannot be skipped by accident.
 */

import { spawn, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SMOKES = [
  ["smoke-inbox-next.mjs"],
  ["smoke-connected-agent-commands.mjs"],
  ["smoke-agent-enroll.mjs"],
  ["smoke-agent-connect.mjs"],
  ["smoke-claude-wake.mjs"],
  ["smoke-presence-controls.mjs"],
  ["smoke-agent-notes.mjs"],
  ["smoke-agent-network.mjs"],
  ["smoke-agent-disconnect.mjs"],
  ["smoke-signals.mjs"],
  ["smoke-contact-requests.mjs"],
  ["smoke-late-contact-notices.mjs"],
  ["smoke-attachment-parts.mjs"],
  ["smoke-pull-commands.mjs"],
  ["smoke-mail-deletion.mjs"],
  ["smoke-listen.mjs"],
  ["smoke-session-notifications.mjs"],
  ["smoke-listen-validation.mjs"],
  ["smoke-concurrent-chats.mjs"],
  ["smoke-send-outcomes.mjs"],
  ["smoke-scoped-chat.mjs"],
  ["smoke-scoped-email-wait.mjs"],
  ["smoke-pushed-replies.mjs", "waits"],
  ["smoke-pushed-replies.mjs", "handoff"],
  ["smoke-pushed-replies.mjs", "notifications"],
];

const [, , binArg] = process.argv;
if (!binArg) {
  console.error("usage: run-cli-smoke-scripts.mjs <primitive-bin>");
  process.exit(2);
}
const bin = resolve(binArg);
const scriptsDir = dirname(fileURLToPath(import.meta.url));

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const concurrency = positiveInteger(
  process.env.CLI_SMOKE_CONCURRENCY,
  availableParallelism() * 2,
);
const timeoutMs = positiveInteger(process.env.CLI_SMOKE_TIMEOUT_MS, 300_000);

const listed = new Set(SMOKES.map(([script]) => script));
const unlisted = readdirSync(scriptsDir).filter(
  (name) => /^smoke-.*\.mjs$/.test(name) && !listed.has(name),
);
if (unlisted.length > 0) {
  console.error(
    `Smoke scripts missing from scripts/run-cli-smoke-scripts.mjs: ${unlisted.join(", ")}`,
  );
  process.exit(1);
}

function baseEnv() {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (
      name.startsWith("PRIMITIVE_") &&
      name !== "PRIMITIVE_SKIP_NEW_VERSION_CHECK"
    )
      delete env[name];
  }
  return env;
}

const running = new Set();

function killTree(child) {
  try {
    if (process.platform !== "win32" && child.pid)
      process.kill(-child.pid, "SIGKILL");
    else child.kill("SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

// Some smoke scripts start background listeners whose supervisors detach
// into their own process groups, so killing the script's group can miss
// them when the script dies before its own cleanup runs. Every process a
// script starts inherits its private HOME, so find and kill those too.
function pidsWithHome(home) {
  const needle = `HOME=${home}`;
  const pids = [];
  if (process.platform === "linux") {
    for (const entry of readdirSync("/proc")) {
      if (!/^\d+$/.test(entry)) continue;
      try {
        const environ = readFileSync(`/proc/${entry}/environ`, "utf8");
        if (environ.split("\0").includes(needle)) pids.push(Number(entry));
      } catch {
        // The process exited or is not readable.
      }
    }
  } else if (process.platform !== "win32") {
    const listing = spawnSync("ps", ["eww", "-ax", "-o", "pid=,command="], {
      encoding: "utf8",
    });
    for (const line of (listing.stdout ?? "").split("\n")) {
      if (line.includes(` ${needle} `) || line.endsWith(` ${needle}`)) {
        pids.push(Number.parseInt(line, 10));
      }
    }
  }
  return pids.filter((pid) => Number.isInteger(pid) && pid !== process.pid);
}

function killLeftovers(home) {
  const pids = pidsWithHome(home);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already gone.
    }
  }
  return pids.length;
}

const homes = new Set();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    for (const child of running) killTree(child);
    for (const home of homes) killLeftovers(home);
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

function runOne([script, ...args]) {
  const label = [script.replace(/\.mjs$/, ""), ...args].join(" ");
  const home = mkdtempSync(join(tmpdir(), "primitive-cli-smoke-home-"));
  homes.add(home);
  const scratch = join(home, "tmp");
  const env = {
    ...baseEnv(),
    HOME: home,
    XDG_CONFIG_HOME: join(home, ".config"),
    TMPDIR: scratch,
  };
  const started = Date.now();
  return new Promise((done) => {
    const chunks = [];
    let child;
    try {
      mkdirSync(scratch);
      // Each script leads its own process group so a timeout can stop the
      // CLI processes and helpers it started along with it.
      child = spawn(
        process.execPath,
        [join(scriptsDir, script), bin, ...args],
        {
          detached: process.platform !== "win32",
          env,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      running.add(child);
    } catch (error) {
      done({
        label,
        ok: false,
        status: "spawn error",
        seconds: 0,
        output: String(error?.stack ?? error),
        home,
      });
      return;
    }
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.once("error", (error) =>
      chunks.push(Buffer.from(`${error.stack ?? error}\n`)),
    );
    let timedOut = false;
    let finished = false;
    const finish = (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const seconds = (Date.now() - started) / 1000;
      const status = timedOut
        ? `timed out after ${timeoutMs}ms`
        : signal
          ? `signal ${signal}`
          : `exit ${code}`;
      done({
        label,
        ok: !timedOut && code === 0,
        status,
        seconds,
        output: Buffer.concat(chunks).toString("utf8"),
        home,
      });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    // A grandchild that escaped the kill could hold the output pipes open and
    // delay "close" forever, so a timed out script finishes shortly after exit.
    child.once("exit", (code, signal) => {
      running.delete(child);
      if (timedOut) setTimeout(() => finish(code, signal), 1000);
    });
    child.once("close", finish);
  });
}

async function main() {
  const queue = SMOKES.slice();
  const results = [];
  const started = Date.now();
  console.log(
    `Running ${SMOKES.length} CLI smoke scripts, ${concurrency} at a time`,
  );

  async function worker() {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const result = await runOne(next);
      results.push(result);
      const verdict = result.ok ? "PASS" : `FAIL (${result.status})`;
      const body = result.output.trimEnd();
      const header = `[cli-smoke] ${verdict} ${result.label} in ${result.seconds.toFixed(1)}s`;
      if (process.env.GITHUB_ACTIONS === "true" && result.ok) {
        console.log(`::group::${header}`);
        if (body) console.log(body);
        console.log("::endgroup::");
      } else {
        console.log(header);
        if (body) console.log(body.replace(/^/gm, `  ${result.label} | `));
      }
      const leftovers = killLeftovers(result.home);
      if (leftovers > 0) {
        console.log(
          `[cli-smoke] stopped ${leftovers} leftover process(es) from ${result.label}`,
        );
      }
      homes.delete(result.home);
      rmSync(result.home, { recursive: true, force: true });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, SMOKES.length) }, worker),
  );

  const failed = results.filter((result) => !result.ok);
  const total = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\n[cli-smoke] ${results.length - failed.length}/${results.length} smoke scripts passed in ${total}s`,
  );
  for (const result of results.slice().sort((a, b) => b.seconds - a.seconds)) {
    console.log(
      `  ${result.ok ? "pass" : "FAIL"} ${result.seconds.toFixed(1).padStart(6)}s  ${result.label}`,
    );
  }
  if (failed.length > 0) {
    for (const result of failed) {
      const message = `CLI smoke script failed: ${result.label} (${result.status})`;
      console.error(
        process.env.GITHUB_ACTIONS === "true"
          ? `::error title=CLI smoke::${message}`
          : message,
      );
    }
    process.exit(1);
  }
}

await main();
