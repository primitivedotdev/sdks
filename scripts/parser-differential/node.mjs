import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

const { parseInteractionEnvelope, validateInteractionEnvelope } = await import(
  pathToFileURL(process.argv[2])
);
function canonical(value) {
  if (value === null) return ["null"];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "number") {
    const b = Buffer.alloc(8);
    b.writeDoubleBE(value);
    return ["number", b.toString("hex")];
  }
  if (typeof value === "string") return ["string", value];
  if (Array.isArray(value)) return ["array", value.map(canonical)];
  return [
    "object",
    Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, canonical(v)]),
    ),
  ];
}
function special(base, spec) {
  switch (spec) {
    case "cycle":
      base.payload = base;
      break;
    case "alias": {
      const shared = { n: 1 };
      base.payload = [shared, shared];
      break;
    }
    case "dag": {
      let shared = { n: 1 };
      for (let i = 0; i < 20; i++) shared = { a: shared, b: shared };
      base.payload = shared;
      break;
    }
    case "host-object":
      base.payload = new (class Custom {})();
      break;
    case "bytes":
      base.payload = new Uint8Array([1]);
      break;
    case "function":
      base.payload = () => 1;
      break;
    case "bigint":
      base.payload = 9007199254740993n;
      break;
    case "nan":
      base.payload = NaN;
      break;
    case "infinity":
      base.payload = Infinity;
      break;
    case "negative-infinity":
      base.payload = -Infinity;
      break;
    case "negative-zero":
      base.payload = -0;
      break;
    case "surrogate":
      base.payload = "\ud800";
      break;
    case "surrogate-key":
      base.payload = { "\ud800": 1 };
      break;
  }
  return base;
}
for await (const line of createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})) {
  try {
    const c = JSON.parse(line);
    const raw = Buffer.from(c.hex ?? "", "hex");
    const value = special(c.value, c.special);
    const result =
      c.mode === "decoded"
        ? validateInteractionEnvelope(value)
        : parseInteractionEnvelope(
            c.mode === "text" ? raw.toString("utf8") : raw,
          );
    const out = { status: result.status };
    if (result.reason) out.reason = result.reason;
    if (result.status === "valid") out.envelope = canonical(result.envelope);
    if (result.status === "unsupported")
      out.version = canonical(result.version);
    if (c.mode === "decoded") {
      out.source = result.source === undefined;
      if (result.status === "valid") {
        const before = JSON.stringify(canonical(result.envelope));
        if (value.payload && typeof value.payload === "object") {
          const target =
            Array.isArray(value.payload) &&
            value.payload[0] &&
            typeof value.payload[0] === "object"
              ? value.payload[0]
              : value.payload;
          if (Array.isArray(target)) target.push("changed");
          else target.changed = true;
        } else value.payload = { changed: true };
        out.snapshot = before === JSON.stringify(canonical(result.envelope));
      }
    } else {
      if (result.status === "invalid") out.source = result.source === undefined;
      else {
        const original = Buffer.from(raw);
        raw.fill(0);
        out.source =
          result.source.text === original.toString("utf8") &&
          (c.mode === "text" ||
            Buffer.from(result.source.bytes).equals(original));
        out.sourceHash = createHash("sha256")
          .update(result.source.text, "utf8")
          .digest("hex");
      }
    }
    console.log(JSON.stringify(out));
  } catch (e) {
    console.log(JSON.stringify({ crash: String(e) }));
  }
}
