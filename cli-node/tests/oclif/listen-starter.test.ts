import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listenStarterFiles,
  writeListenStarter,
} from "../../src/oclif/listen-starter.js";

const dirs: string[] = [];
function scaffold() {
  const parent = mkdtempSync(join(tmpdir(), "primitive-starter-"));
  dirs.push(parent);
  const outDir = join(parent, "receiver");
  writeListenStarter({ outDir });
  return outDir;
}
function accept(
  dir: string,
  body: string,
  eventId: string = randomUUID(),
  eventType = "email.received",
) {
  return spawnSync("python3", [join(dir, "accept_event.py")], {
    input: body,
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      PRIMITIVE_EVENT_ID: eventId,
      PRIMITIVE_EVENT_TYPE: eventType,
      PRIMITIVE_DELIVERY_ID: randomUUID(),
      PYTHONDONTWRITEBYTECODE: "1",
    },
  });
}
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("Python local receiver starter", () => {
  it("commits full email and related bodies, deduplicates stable IDs across restarts, and keeps state private", () => {
    const dir = scaffold();
    const id = randomUUID();
    const body = '{ "event": "email.received", "email": {"text":"héllo"} }\n';
    expect(accept(dir, body, id).status).toBe(0);
    expect(accept(dir, '{"later_attempt":true}', id).status).toBe(0);
    expect(
      accept(
        dir,
        '{"interaction":{"id":"abc"}}',
        randomUUID(),
        "interaction.ack.received",
      ).status,
    ).toBe(0);
    const inspected = spawnSync(
      "python3",
      [
        "-c",
        "import sqlite3,json,sys; d=sqlite3.connect(sys.argv[1]); print(json.dumps([(r[0],r[1],r[2].decode(),r[3]) for r in d.execute('SELECT event_id,event_type,body,processed_at FROM events ORDER BY rowid')]))",
        join(dir, ".primitive-inbox/events.sqlite3"),
      ],
      { encoding: "utf8" },
    );
    expect(inspected.status).toBe(0);
    const rows = JSON.parse(inspected.stdout) as unknown[][];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual([id, "email.received", body, null]);
    expect(rows[1]?.[1]).toBe("interaction.ack.received");
    expect(statSync(join(dir, ".primitive-inbox")).mode & 0o777).toBe(0o700);
    expect(
      statSync(join(dir, ".primitive-inbox/events.sqlite3")).mode & 0o777,
    ).toBe(0o600);
  });
  it("returns nonzero on persistence failure without leaking input", () => {
    const dir = scaffold();
    writeFileSync(join(dir, ".primitive-inbox"), "blocked");
    const result = accept(dir, '{"secret":"do-not-print"}');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not durably accepted");
    expect(result.stderr).not.toContain("do-not-print");
  });
  it("rejects malformed input and does not overwrite existing directories", () => {
    const dir = scaffold();
    const original = readFileSync(join(dir, "accept_event.py"), "utf8");
    expect(() => writeListenStarter({ outDir: dir })).toThrow();
    expect(readFileSync(join(dir, "accept_event.py"), "utf8")).toBe(original);
    expect(accept(dir, "not json").status).toBe(1);
    expect(accept(dir, "{}", "invalid-uuid").status).toBe(1);
  });
  it("emits syntactically valid standalone Python and documents the exact command", () => {
    const dir = scaffold();
    const result = spawnSync(
      "python3",
      [
        "-c",
        "import ast,pathlib,sys; [ast.parse(p.read_text()) for p in pathlib.Path(sys.argv[1]).glob('*.py')]",
        dir,
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(listenStarterFiles()["README.md"]).toContain(
      "primitive listen --subscription my-agent --exec 'python3 accept_event.py'",
    );
    expect(listenStarterFiles()[".gitignore"]).toContain(".primitive-inbox/");
  });

  it("keeps failed processing pending and resumes it in a new worker process", () => {
    const dir = scaffold();
    const eventId = randomUUID();
    expect(
      accept(
        dir,
        '{"interaction":{"id":"example"}}',
        eventId,
        "interaction.ack.received",
      ).status,
    ).toBe(0);
    // SDK behavior is checked separately; this exercises the actual generated
    // processor's transaction/lock boundary with an application handler.
    const program = `import sys,types,sqlite3
sys.path.insert(0,sys.argv[1])
for name in ['primitive','primitive.api','primitive.api.api','primitive.api.api.emails']:
    sys.modules[name]=types.ModuleType(name)
sys.modules['primitive.api.api.emails'].get_conversation=None
import process_events
phase=sys.argv[2]
def handle(*args):
    if phase=='fail': raise RuntimeError('application unavailable')
process_events.process_event=handle
sys.argv=['process_events.py','--once']
process_events.main()
`;
    const failed = spawnSync("python3", ["-c", program, dir, "fail"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(failed.status).toBe(1);
    const state = () =>
      spawnSync(
        "python3",
        [
          "-c",
          "import sqlite3,sys; d=sqlite3.connect(sys.argv[1]); print(d.execute('SELECT processed_at IS NOT NULL FROM events').fetchone()[0])",
          join(dir, ".primitive-inbox/events.sqlite3"),
        ],
        { encoding: "utf8" },
      ).stdout.trim();
    expect(state()).toBe("0");
    const resumed = spawnSync("python3", ["-c", program, dir, "succeed"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(resumed.status).toBe(0);
    expect(state()).toBe("1");
  });

  it("binds both SDK clients to an explicit custom origin and refuses an isolated send override", () => {
    const dir = scaffold();
    const program = `import sys,types,os,json
sys.path.insert(0,sys.argv[1])
for name in ['primitive','primitive.api','primitive.api.api','primitive.api.api.emails']:
    sys.modules[name]=types.ModuleType(name)
sys.modules['primitive.api.api.emails'].get_conversation=None
sys.modules['primitive'].client=lambda **kwargs: kwargs
import process_events
os.environ['PRIMITIVE_API_KEY']='offline-key'
os.environ['PRIMITIVE_API_BASE_URL']='https://custom.example.test/v1'
os.environ.pop('PRIMITIVE_API_BASE_URL_2',None)
first=process_events.create_client()
assert first['api_base_url_1']==first['api_base_url_2']=='https://custom.example.test/v1'
os.environ['PRIMITIVE_API_BASE_URL_2']='https://send.example.test/v1'
assert process_events.create_client()['api_base_url_2']=='https://send.example.test/v1'
del os.environ['PRIMITIVE_API_BASE_URL']
try: process_events.create_client()
except ValueError: pass
else: raise AssertionError('custom send origin cannot silently select default read origin')
`;
    const result = spawnSync("python3", ["-c", program, dir], {
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(result.status, result.stderr).toBe(0);
  });
});
