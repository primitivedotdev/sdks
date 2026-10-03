#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const receiver = process.argv.length === 4 && process.argv[2] === '--receiver'
  ? process.argv[3]
  : null;
if (receiver !== 'native' && receiver !== 'external' && receiver !== 'poll') {
  process.stderr.write('Usage: node scripts/check-cli-capabilities.mjs --receiver native|external|poll\n');
  process.exitCode = 2;
} else {
  const checks = [
    { args: ['agent', 'connect', '--help'], label: 'agent connect', patterns: [/--session\b/, /--receiver\b/] },
    { args: ['agent', 'enroll', '--help'], label: 'agent enroll', patterns: [/--session\b/, /--receiver\b/, /--name\b/] },
    { args: ['listen', '--help'], label: 'listen', patterns: [/external mail events at tool-output authority/i, /never synthetic user messages/i] },
    { args: ['network', 'peers', '--help'], label: 'network peers', patterns: [/discover listed peers/i, /--owner\b/] },
  ];
  if (receiver === 'poll') {
    // Nothing is installed and no listener runs: the agent checks for mail.
    checks[0].patterns.push(/poll installs nothing/i);
    checks[1].patterns.push(/\bpoll\b/);
    checks[2] = { args: ['agent', 'check-mail', '--help'], label: 'agent check-mail', patterns: [/since its previous check/i] };
  } else if (receiver === 'external') {
    checks[0].patterns.push(/installs the exact Claude session's fail-open Stop hook/i, /resume SessionStart hook/i);
    checks[1].patterns.push(/exact Claude session, install a fail-open Stop hook/i, /resume SessionStart hook/i);
    checks[2].patterns.push(/--wake\b/, /--hook-session\b/);
  } else {
    checks[2].patterns.push(/--notify-session\b/, /--background\b/);
  }

  const missing = [];
  for (const { args, label, patterns } of checks) {
    const result = spawnSync('primitive', args, {
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 128 * 1024,
    });
    if (result.error || result.status !== 0) {
      missing.push(`${label} --help is unavailable`);
      continue;
    }
    const help = result.stdout.replace(/\s+/g, ' ');
    if (patterns.some((pattern) => !pattern.test(help))) {
      missing.push(`${label} --help lacks required setup, ${receiver} receiving, or peer-discovery support`);
    }
  }

  if (missing.length) {
    process.stderr.write(`Primitive CLI preflight failed: ${missing.join('; ')}. Do not claim the invitation or create an address with this CLI. Install a CLI build with these capabilities and run this check again, or connect with the HTTP API instead.\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Primitive CLI preflight passed for ${receiver} receiving and peer discovery.\n`);
  }
}
