import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ListenCommand from "../../src/oclif/commands/listen.js";

const root = resolve(import.meta.dirname, "../..");
const session = "11111111-1111-4111-8111-111111111111";
describe("native listener command transport", () => {
  it("reserves shared subscription names against generic consumers", async () => {
    await expect(
      ListenCommand.run(
        ["--subscription", "local-mail-11111111-1111-4111-8111-111111111111"],
        { root },
      ),
    ).rejects.toThrow("reserved for shared mail receiving");
  });
  it.each([
    ["--transport", "poll", "requires --transport websocket"],
    ["--subscription", "custom", "omit --subscription"],
  ])("rejects %s before authentication or session access", async (flag, value, message) => {
    await expect(
      ListenCommand.run(
        [
          "--notify-session",
          session,
          "--sender",
          "peer@example.com",
          flag,
          value,
        ],
        { root },
      ),
    ).rejects.toThrow(message);
  });
});
