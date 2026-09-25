import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  type AutomatedMailInput,
  classifyAutomatedMail,
  declaredAutomationReasons,
  domainPart,
  extractEmailAddresses,
  localPart,
  loopReasons,
} from "../../src/oclif/automated-mail.js";
import { renderHandler } from "../../src/oclif/function-templates.js";

function input(
  overrides: Partial<AutomatedMailInput> = {},
): AutomatedMailInput {
  return {
    envelopeSender: "alice@example.com",
    fromHeaders: ["Alice <alice@example.com>"],
    inboundAddresses: ["agent@acme.primitive.email"],
    ...overrides,
  };
}

describe("address helpers", () => {
  it("extracts lowercase addresses from display-name headers", () => {
    expect(extractEmailAddresses('"Alice" <Alice@Example.COM>')).toEqual([
      "alice@example.com",
    ]);
    expect(extractEmailAddresses(null)).toEqual([]);
    expect(extractEmailAddresses("not an address")).toEqual([]);
  });

  it("splits local and domain parts", () => {
    expect(domainPart("Bob@Example.com")).toBe("example.com");
    expect(domainPart("nodomain")).toBeNull();
    expect(localPart("MAILER-DAEMON@x.com")).toBe("mailer-daemon");
    expect(localPart("bare")).toBe("bare");
  });
});

describe("classifyAutomatedMail", () => {
  it("passes a normal person-to-agent email", () => {
    expect(classifyAutomatedMail(input())).toEqual({
      automated: false,
      reasons: [],
    });
  });

  it("flags a null envelope sender as a bounce", () => {
    for (const envelopeSender of ["", "<>", " ", null, undefined]) {
      expect(
        classifyAutomatedMail(input({ envelopeSender })).reasons,
      ).toContain("null_envelope_sender");
    }
  });

  it("flags mail with no sender address anywhere", () => {
    expect(
      classifyAutomatedMail(
        input({ envelopeSender: "", fromHeaders: [null, "undisclosed"] }),
      ).reasons,
    ).toEqual(["null_envelope_sender", "no_identifiable_sender"]);
  });

  it("flags mailer-daemon and postmaster on any domain by default", () => {
    for (const from of [
      "MAILER-DAEMON@mx.remote.example",
      "postmaster@remote.example",
    ]) {
      expect(
        classifyAutomatedMail(
          input({ envelopeSender: from, fromHeaders: [from] }),
        ).reasons,
      ).toEqual(["mailer_daemon"]);
    }
  });

  it("limits mailer-daemon to inbound domains in handler scope", () => {
    const remote = "mailer-daemon@remote.example";
    expect(
      loopReasons(
        input({
          envelopeSender: remote,
          fromHeaders: [remote],
          daemonScope: "inbound",
        }),
      ),
    ).toEqual([]);
    const local = "mailer-daemon@acme.primitive.email";
    expect(
      loopReasons(
        input({
          envelopeSender: local,
          fromHeaders: [local],
          daemonScope: "inbound",
        }),
      ),
    ).toEqual(["mailer_daemon"]);
  });

  it("flags mail from our own inbound address or an extra self address", () => {
    expect(
      classifyAutomatedMail(
        input({ fromHeaders: ["Agent <agent@acme.primitive.email>"] }),
      ).reasons,
    ).toEqual(["own_address"]);
    expect(
      classifyAutomatedMail(
        input({
          envelopeSender: "bot@other.example",
          fromHeaders: ["bot@other.example"],
          extraSelfAddresses: ["BOT@other.example"],
        }),
      ).reasons,
    ).toEqual(["own_address"]);
  });

  it("reports declared automation headers", () => {
    expect(
      classifyAutomatedMail(
        input({
          automationHeaders: {
            auto_submitted: "auto-replied; owner-email=x@y.z",
            precedence: "Bulk",
            list_unsubscribe: "<mailto:unsub@example.com>",
            list_id: "<news.example.com>",
          },
        }),
      ),
    ).toEqual({
      automated: true,
      reasons: ["auto_submitted", "precedence", "list_unsubscribe", "list_id"],
    });
  });
});

describe("declaredAutomationReasons", () => {
  it("treats Auto-Submitted: no as a person", () => {
    expect(declaredAutomationReasons({ auto_submitted: "No" })).toEqual([]);
  });

  it("ignores normal precedence and empty values", () => {
    expect(
      declaredAutomationReasons({
        precedence: "first-class",
        list_unsubscribe: "  ",
        auto_submitted: "",
      }),
    ).toEqual([]);
  });

  it("accepts every automated precedence value", () => {
    for (const precedence of ["bulk", "list", "junk", "auto_reply"]) {
      expect(declaredAutomationReasons({ precedence })).toEqual(["precedence"]);
    }
  });

  it("handles missing or malformed header objects", () => {
    expect(declaredAutomationReasons(null)).toEqual([]);
    expect(declaredAutomationReasons(undefined)).toEqual([]);
    expect(
      declaredAutomationReasons({ auto_submitted: 5 as unknown as string }),
    ).toEqual([]);
  });
});

// The scaffolded Function handler carries its own rendered copy of the
// loop rules, because user code cannot import the CLI. Execute that
// rendered isLoop against the same cases as loopReasons() so the two
// definitions cannot drift apart.
type LoopEvent = {
  email: {
    smtp: { mail_from: string; rcpt_to: string[] };
    headers: { from: string; to: string };
  };
};

async function loadRenderedIsLoop(): Promise<(event: LoopEvent) => boolean> {
  const source = renderHandler().replace(
    /import\s*\{[\s\S]*?\}\s*from\s*"@primitivedotdev\/sdk\/api";/,
    "type EmailReceivedEvent = any;",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const mod = (await import(
    `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
  )) as { isLoop: (event: LoopEvent) => boolean };
  return mod.isLoop;
}

const PARITY_CASES: Array<{
  name: string;
  mailFrom: string;
  from: string;
  rcptTo: string[];
  to: string;
}> = [
  {
    name: "person",
    mailFrom: "alice@example.com",
    from: "Alice <alice@example.com>",
    rcptTo: ["agent@acme.primitive.email"],
    to: "agent@acme.primitive.email",
  },
  {
    name: "null envelope",
    mailFrom: "",
    from: "MAILER-DAEMON@mx.example",
    rcptTo: ["agent@acme.primitive.email"],
    to: "agent@acme.primitive.email",
  },
  {
    name: "angle-bracket null envelope",
    mailFrom: "<>",
    from: "someone@example.com",
    rcptTo: ["agent@acme.primitive.email"],
    to: "agent@acme.primitive.email",
  },
  {
    name: "self mail",
    mailFrom: "agent@acme.primitive.email",
    from: "agent@acme.primitive.email",
    rcptTo: ["agent@acme.primitive.email"],
    to: "agent@acme.primitive.email",
  },
  {
    name: "same-domain postmaster",
    mailFrom: "postmaster@acme.primitive.email",
    from: "postmaster@acme.primitive.email",
    rcptTo: ["agent@acme.primitive.email"],
    to: "agent@acme.primitive.email",
  },
  {
    name: "remote mailer-daemon (handler scope: not a loop)",
    mailFrom: "mailer-daemon@remote.example",
    from: "mailer-daemon@remote.example",
    rcptTo: ["agent@acme.primitive.email"],
    to: "agent@acme.primitive.email",
  },
  {
    name: "unparseable sender with non-empty envelope",
    mailFrom: "garbage",
    from: "also garbage",
    rcptTo: ["agent@acme.primitive.email"],
    to: "agent@acme.primitive.email",
  },
  {
    name: "sender listed in To header",
    mailFrom: "team@acme.primitive.email",
    from: "team@acme.primitive.email",
    rcptTo: ["agent@acme.primitive.email"],
    to: "agent@acme.primitive.email, team@acme.primitive.email",
  },
];

describe("scaffolded isLoop parity", () => {
  it.each(PARITY_CASES)("agrees with loopReasons for: $name", async (c) => {
    const isLoop = await loadRenderedIsLoop();
    const rendered = isLoop({
      email: {
        smtp: { mail_from: c.mailFrom, rcpt_to: c.rcptTo },
        headers: { from: c.from, to: c.to },
      },
    });
    const shared =
      loopReasons({
        envelopeSender: c.mailFrom,
        fromHeaders: [c.from],
        inboundAddresses: [...c.rcptTo, c.to],
        daemonScope: "inbound",
      }).length > 0;
    expect(rendered).toBe(shared);
  });
});
