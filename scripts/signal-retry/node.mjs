// Runs in an isolated npm install, never against workspace source imports.
import { randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createClient, sendEmail } from "@primitivedotdev/sdk/api";
import {
  prepareSignalEmail,
  sendPreparedSignal,
} from "@primitivedotdev/sdk/interactions";

const [mode, record, url, clock, scope, kind] = process.argv.slice(2);
const now = Number(clock);
if (mode === "prepare") {
  const result = prepareSignalEmail(
    {
      kind,
      status: "received",
      expiresAtMs: now + 60_000,
      parent: {
        accountScope: scope,
        from: "owner@example.test",
        to: "agent@example.test",
        messageId: "<parent@example.test>",
        subject: "Research café",
        references: ["<ancestor@example.test>"],
      },
    },
    { uuid: randomUUID, now: () => now },
  );
  if (result.status !== "prepared") throw new Error("not prepared");
  const fd = openSync(record, "wx", 0o600);
  try {
    writeFileSync(fd, JSON.stringify(result.prepared));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  console.log(JSON.stringify({ status: "prepared" }));
} else {
  const prepared = JSON.parse(readFileSync(record, "utf8"));
  const client = createClient({ baseUrl: url });
  const result = await sendPreparedSignal(
    async (body, key) => {
      const response = await sendEmail({
        client,
        body,
        headers: { "Idempotency-Key": key },
      });
      if (response.response.status !== 200)
        throw new Error("ordinary send failed");
      return response.data;
    },
    prepared,
    { accountScope: scope, now: () => now },
  );
  console.log(JSON.stringify(result));
}
