import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openapiDocument, operationManifest } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import { OPERATION_EXTENSIONS } from "../../src/oclif/api-command.js";
import {
  COMMAND_RENAMES,
  canonicalCommandId,
  operationCommandId,
} from "../../src/oclif/cli-command-names.js";
import {
  CLI_OMITTED_OPERATION_IDS,
  CREDENTIAL_HEADER_OPERATION_IDS,
  cliOperationManifest,
  KEY_WRITE_OPERATION_IDS,
  NOT_YET_OFFERED_OPERATION_IDS,
  rawCliOperationManifest,
} from "../../src/oclif/cli-operations.js";
import {
  CANONICAL_OPERATION_ALIASES,
  COMMANDS,
} from "../../src/oclif/index.js";

function readCliPackageJson(): {
  files?: string[];
  oclif?: {
    hooks?: Record<string, string>;
    plugins?: string[];
    topics?: Record<string, { description?: string; hidden?: boolean }>;
    "warn-if-update-available"?: {
      frequency?: number;
      frequencyUnit?: string;
      message?: string;
      timeoutInDays?: number;
    };
    topicSeparator?: string;
  };
  scripts?: Record<string, string>;
} {
  const packageJsonPath = fileURLToPath(
    new URL("../../package.json", import.meta.url),
  );
  return JSON.parse(readFileSync(packageJsonPath, "utf8"));
}

// Regression guard for the discovery / execution surface staying in
// sync. `primitive list-operations` enumerates the operation
// manifest, and the CLI's COMMANDS map auto-registers a wrapper
// command for every entry. If a new operation lands in the manifest
// without a matching COMMANDS entry, agents would see it via
// list-operations but get "command not found" when they invoke it.
//
// Separately, a stale static `oclif.manifest.json` shipped in the
// package would also cause this gap (oclif looks up commands via the
// static manifest before falling through to the runtime COMMANDS map,
// so any entry missing from the static file is unreachable even when
// the runtime map has it). The second assertion in this file is the
// explicit guard against that mode: the package must not ship a
// pre-built oclif manifest.
describe("COMMANDS / manifest coverage", () => {
  it("never consumes stdin as a positional argument", () => {
    for (const [id, command] of Object.entries(COMMANDS)) {
      for (const [name, argument] of Object.entries(command.args ?? {})) {
        expect(argument.ignoreStdin, `${id} ${name}`).toBe(true);
      }
    }
    expect(readCliPackageJson().oclif?.hooks?.prerun).toBe(
      "./dist/oclif/command-stdin.js",
    );
  });

  it("removes every retired command spelling and keeps each replacement registered", () => {
    for (const [oldId, newId] of Object.entries(COMMAND_RENAMES)) {
      expect(COMMANDS[oldId], oldId).toBeUndefined();
      expect(COMMANDS[newId], newId).toBeDefined();
    }
    expect(COMMANDS.org).toBeUndefined();
    expect(COMMANDS["org:list"]).toBeDefined();
  });

  it("preserves API descriptors while projecting executable command names", () => {
    for (const raw of rawCliOperationManifest) {
      const projected = cliOperationManifest.find(
        (op) => op.operationId === raw.operationId,
      );
      expect(projected).toBeDefined();
      expect(
        projected && {
          ...projected,
          tagCommand: raw.tagCommand,
          command: raw.command,
          description: raw.description,
        },
      ).toEqual(raw);
    }
  });

  it("requires flag metadata before an extension starts supplying a required body property", () => {
    function requiredProperties(schema: unknown): string[] {
      if (!schema || typeof schema !== "object" || Array.isArray(schema))
        return [];
      const node = schema as Record<string, unknown>;
      return [
        ...(Array.isArray(node.required)
          ? node.required.filter(
              (name): name is string => typeof name === "string",
            )
          : []),
        ...[node.allOf, node.oneOf, node.anyOf].flatMap((branches) =>
          Array.isArray(branches) ? branches.flatMap(requiredProperties) : [],
        ),
      ];
    }
    for (const operation of cliOperationManifest) {
      const supplied =
        OPERATION_EXTENSIONS[operation.sdkName]?.bodyProperties ?? [];
      const required = requiredProperties(operation.requestSchema);
      // Required extension fields need a missing-field flag mapping before
      // they are introduced; otherwise errors incorrectly advise JSON only.
      expect(
        supplied.filter((name) => required.includes(name)),
        `${operation.sdkName}: map required extension fields to their flags`,
      ).toEqual([]);
    }
  });

  it("registers agent network parent, convenience commands, and generated operations", () => {
    for (const name of [
      "network",
      "network:list",
      "network:members",
      "network:peers",
      "network:get",
      "network:set",
      "network:add",
      "network:remove",
    ])
      expect(COMMANDS[name]).toBeDefined();
    for (const name of [
      "list",
      "list-members",
      "list-agents",
      "get-agent",
      "add-member",
      "delete-member",
      "update-member",
      "check-contact-admission",
    ])
      expect(COMMANDS[`agent-networks:${name}`]).toBeDefined();
    const admission = operationManifest.find(
      (operation) =>
        operation.operationId === "checkDefaultNetworkContactAdmission",
    );
    expect(admission?.requestSchema).toMatchObject({
      required: ["email_id", "sender_address"],
    });
    const listNetworks = operationManifest.find(
      (operation) => operation.operationId === "listAgentNetworks",
    );
    expect(listNetworks?.responseSchema).toMatchObject({
      items: { required: expect.arrayContaining(["can_manage_all"]) },
    });
    const listMembers = operationManifest.find(
      (operation) => operation.operationId === "listDefaultNetworkMembers",
    );
    expect(listMembers?.responseSchema).toMatchObject({
      items: { required: expect.arrayContaining(["can_manage"]) },
    });
    const set = COMMANDS["network:set"] as unknown as {
      flags: Record<string, unknown>;
      description: string;
    };
    const members = COMMANDS["network:members"] as unknown as {
      description: string;
    };
    const peers = COMMANDS["network:peers"] as unknown as {
      description: string;
      flags: Record<string, unknown>;
    };
    expect(peers.description).toContain("recorded API activity");
    expect(peers.description).toContain("owner name");
    expect(peers.flags.owner).toBeDefined();
    expect(
      operationManifest
        .find(
          (operation) => operation.operationId === "listDefaultNetworkAgents",
        )
        ?.queryParams.map((parameter) => parameter.name),
    ).toContain("owner");
    expect(set.flags.see).toBeDefined();
    expect(set.flags["be-seen"]).toBeDefined();
    expect(members.description).toContain("currently owned personal agents");
    expect(set.description).toContain("currently owned personal agents");
    expect(set.description).toContain("initiating network-driven mail wake");
    expect(set.description).toContain(
      "network-driven wake from viewing senders",
    );
    expect(readCliPackageJson().oclif?.topics?.network?.description).toContain(
      "primitive network",
    );
  });
  it("registers explicit signal and scoped doctor help", () => {
    const signal = COMMANDS.signal as unknown as {
      args: { kind: { options: string[] } };
      flags: Record<string, unknown>;
      description: string;
    };
    expect(signal.args.kind.options).toEqual([
      "read",
      "ack",
      "working",
      "typing",
    ]);
    for (const flag of ["id", "status", "expires-in", "json"])
      expect(signal.flags[flag]).toBeDefined();
    expect(signal.flags.from).toBeUndefined();
    expect(signal.flags.to).toBeUndefined();
    expect(signal.description).toContain("Unknown outcomes must reconcile");
    expect(
      (COMMANDS.doctor as unknown as { description: string }).description,
    ).toContain("identity offline");
  });
  it("advertises exact-session external receiving on invitation setup", () => {
    const connect = COMMANDS["agent:connect"] as unknown as {
      flags: Record<string, unknown>;
      description: string;
    };
    expect(connect.flags.session).toBeDefined();
    expect(connect.flags.receiver).toBeDefined();
    expect(connect.description).toContain("fail-open Stop hook");
    expect(connect.description).toContain("resume SessionStart hook");
    expect(connect.description).toContain("real idle mail event");
    const listen = COMMANDS.listen as unknown as {
      description: string;
      flags: { contacts: { description: string } };
    };
    expect(listen.description).toContain("exact already-loaded thread");
    expect(listen.description).toContain(
      "Verified presence controls are handled without model turns",
    );
    expect(listen.description).toContain("do not consume --once or --number");
    expect(listen.description).toContain("eligible same-org network peers");
    expect(listen.flags.contacts.description).toContain(
      "explicit contact or owner silence",
    );
  });
  it("registers organization and per-agent contact commands", () => {
    for (const action of [
      "list",
      "get",
      "create",
      "update",
      "delete",
      "request",
      "accept",
      "wait",
    ])
      expect(COMMANDS[`contacts:${action}`]).toBeDefined();
    for (const action of ["list", "create", "update", "delete"])
      expect(COMMANDS[`agent:contacts:${action}`]).toBeDefined();
    expect(readCliPackageJson().oclif?.topics?.contacts).toBeDefined();
    expect(
      readCliPackageJson().oclif?.topics?.["agent:contacts"],
    ).toBeDefined();
  });
  it("registers address note commands with explicit value and visibility controls", () => {
    for (const action of ["list", "get", "set", "delete"])
      expect(COMMANDS[`agent:notes:${action}`]).toBeDefined();
    const set = COMMANDS["agent:notes:set"] as unknown as {
      flags: Record<string, { exclusive?: string[] }>;
      description: string;
    };
    for (const flag of [
      "address",
      "json",
      "value-file",
      "json-value",
      "if-absent",
      "if-version",
      "public",
      "private",
    ])
      expect(set.flags[flag]).toBeDefined();
    expect(set.flags.public.exclusive).toContain("private");
    expect(set.flags["if-version"].exclusive).toContain("if-absent");
    expect(set.description).toContain("Existing visibility is preserved");
    expect(
      readCliPackageJson().oclif?.topics?.["agent:notes"]?.description,
    ).toContain("private");
  });
  it("accepts explicit JSON on every contact and agent-contact convenience command", () => {
    for (const route of [
      ...[
        "list",
        "get",
        "create",
        "update",
        "delete",
        "request",
        "accept",
        "wait",
      ].map((action) => `contacts:${action}`),
      ...["list", "create", "update", "delete"].map(
        (action) => `agent:contacts:${action}`,
      ),
    ]) {
      const command = COMMANDS[route] as unknown as {
        flags: Record<string, { type?: string; description?: string }>;
      };
      expect(command.flags.json.type).toBe("boolean");
      expect(command.flags.json.description).toContain("already the default");
    }
    for (const topic of ["contacts", "agent:contacts"])
      expect(
        readCliPackageJson().oclif?.topics?.[topic]?.description,
      ).toContain("--json");
  });
  it("exposes the four owner policy operations with explicit JSON replacement bodies", () => {
    for (const name of [
      "get-policy",
      "set-policy",
      "get-agent-policy",
      "set-agent-policy",
    ]) {
      expect(COMMANDS[`contacts:${name}`]).toBeDefined();
    }
    for (const name of ["set-policy", "set-agent-policy"]) {
      const command = COMMANDS[`contacts:${name}`] as unknown as {
        flags: Record<string, unknown>;
      };
      expect(command.flags["body-file"]).toBeDefined();
      expect(command.flags["raw-body"]).toBeDefined();
    }
  });
  it("exposes explicit contact request consent and durable acceptance recovery", () => {
    const request = COMMANDS["contacts:request"] as unknown as {
      flags: Record<string, unknown>;
      description: string;
    };
    expect(request.description).toContain(
      "Save the peer in the organization directory",
    );
    expect(request.description).toContain(
      "no agent membership or notification preference is changed",
    );
    for (const flag of [
      "reason",
      "notify",
      "wait",
      "expires-in",
      "timeout",
      "json",
    ])
      expect(request.flags[flag]).toBeDefined();
    const wait = COMMANDS["contacts:wait"] as unknown as {
      flags: Record<string, { exclusive?: string[] }>;
    };
    expect(wait.flags["request-id"].exclusive).toContain("id");
  });
  it("routes the canonical invitation claim command through private stdin setup", () => {
    expect(COMMANDS["agent:connect"]).toBeDefined();
    expect(
      COMMANDS["agent-connections:claim-agent-connection"],
    ).toBeUndefined();
    const setup = COMMANDS["agent:connect"] as unknown as {
      description: string;
      flags: Record<string, unknown>;
    };
    expect(setup.description).toContain(
      "https://api.primitive-staging-1.com/v1",
    );
    expect(setup.description).toContain("piped stdin");
    expect(setup.flags.profile).toBeDefined();
    expect(setup.flags.status).toBeDefined();
    for (const flag of ["session", "receiver", "resume", "contact-requests"])
      expect(setup.flags[flag]).toBeDefined();
    expect(setup.flags.token).toBeUndefined();
    expect(setup.flags["raw-body"]).toBeUndefined();
  });
  it("registers every public agent connection management operation", () => {
    const expected = [
      [
        "createAgentConnection",
        "agent-connections:create",
        "POST",
        "/agent-connections",
      ],
      [
        "listAgentConnections",
        "agent-connections:list",
        "GET",
        "/agent-connections",
      ],
      [
        "inviteAgentConnection",
        "agent-connections:invite",
        "POST",
        "/agent-connections/{address}/invitation",
      ],
      [
        "revokeAgentConnection",
        "agent-connections:revoke",
        "DELETE",
        "/agent-connections/{address}",
      ],
      [
        "removeAgentConnection",
        "agent-connections:delete",
        "POST",
        "/agent-connections/{address}/remove",
      ],
      [
        "claimAgentConnection",
        "agent:connect",
        "POST",
        "/agent-connections/claim",
      ],
      [
        "agentConnectionSetup",
        "agent-connections:setup",
        "GET",
        "/agent-connections/setup",
      ],
    ] as const;
    for (const [operationId, command, method, path] of expected) {
      expect(COMMANDS[command], command).toBeDefined();
      expect(
        operationManifest.find((op) => op.operationId === operationId),
      ).toMatchObject({
        method,
        path,
      });
    }
    const list = operationManifest.find(
      (op) => op.operationId === "listAgentConnections",
    );
    expect(JSON.stringify(list?.responseSchema)).toContain("owner_active");
    expect(JSON.stringify(list?.responseSchema)).toContain("ownership_kind");
    expect(
      readCliPackageJson().oclif?.topics?.["agent-connections"]?.description,
    ).toContain("Create, list, invite, revoke, and remove");
  });
  it("preserves caller identity and member address provisioning in the public registry", () => {
    expect(COMMANDS["account:whoami"]).toBeDefined();
    expect(COMMANDS["account:provision-member-address"]).toBeDefined();
    expect(COMMANDS["account:whoami"]).not.toBe(COMMANDS.whoami);
    expect(
      operationManifest.find((op) => op.operationId === "whoami")?.path,
    ).toBe("/whoami");
    expect(
      operationManifest.find(
        (op) => op.operationId === "provisionMemberAddress",
      )?.path,
    ).toBe("/account/member-address");
    const provision = operationManifest.find(
      (op) => op.operationId === "provisionMemberAddress",
    );
    expect(provision?.bodyRequired).toBe(true);
    expect(provision?.requestSchema).toMatchObject({
      required: ["address"],
      properties: {
        address: { type: "string" },
        confirm_existing_mail: { type: "boolean" },
      },
    });
    const identity = operationManifest.find(
      (op) => op.operationId === "whoami",
    );
    expect(JSON.stringify(identity?.responseSchema)).toContain(
      "member_address_suggestion",
    );
    expect(
      (COMMANDS.whoami as unknown as { description: string }).description,
    ).toContain("account whoami");
  });
  it("keeps recoverable create and pending-only invitation fields in the generated command manifest", () => {
    const create = operationManifest.find(
      (op) => op.operationId === "createAgentConnection",
    );
    expect(create?.requestSchema).toMatchObject({
      properties: { create_request_id: { type: "string", format: "uuid" } },
    });
    expect(JSON.stringify(create?.responseSchema)).toContain('"recovered"');
    expect(JSON.stringify(create?.responseSchema)).toContain('"type":"null"');
    const invite = operationManifest.find(
      (op) => op.operationId === "inviteAgentConnection",
    );
    expect(invite?.requestSchema).toMatchObject({
      properties: { pending_only: { type: "boolean" } },
    });
    for (const path of [
      "/agent-connections",
      "/agent-connections/claim",
      "/agent-connections/{address}/invitation",
    ] as const) {
      const paths = openapiDocument.paths as Record<
        string,
        { post: { parameters?: unknown[] } }
      >;
      const parameters = paths[path].post.parameters;
      expect(JSON.stringify(parameters ?? [])).toContain("Idempotency-Key");
    }
  });
  it("registers exact-profile disconnect separately from owner-only removal", () => {
    const disconnect = COMMANDS["agent:disconnect"] as unknown as {
      flags: Record<string, { required?: boolean }>;
      description: string;
    };
    expect(disconnect.flags.profile.required).toBe(true);
    expect(disconnect.flags["api-key"]).toBeUndefined();
    expect(disconnect.flags["api-base-url"]).toBeUndefined();
    expect(disconnect.description).toContain("pinned Primitive origin");
    expect(COMMANDS["agent-connections:delete"]).toBeDefined();
  });
  it("registers trusted-machine session enrollment without an invitation argument", () => {
    const enroll = COMMANDS["agent:enroll"] as unknown as {
      flags: Record<string, { required?: boolean; description?: string }>;
      description: string;
    };
    expect(enroll.flags.session.required).toBe(true);
    expect(enroll.flags.receiver).toBeDefined();
    expect(enroll.flags["continue-setup"]).toBeDefined();
    expect(enroll.flags["continue-setup"].description).toContain(
      "still pending",
    );
    expect(enroll.flags["contact-requests"]).toBeDefined();
    expect(enroll.flags["contact-requests"].description).toContain(
      "saved member login",
    );
    expect(enroll.flags["api-key"]).toBeUndefined();
    expect(enroll.flags.invitation).toBeUndefined();
    expect(enroll.description).toContain("saved member OAuth login");
    expect(enroll.description).toContain("preserving existing policy rules");
    expect(enroll.description).toContain(
      "owner's connection list for confirmed pairing",
    );
    expect(enroll.description).toContain("install a fail-open Stop hook");
    expect(enroll.description).toContain("resume SessionStart hook");
    expect(enroll.description).toContain("saved request");
  });
  it("exposes saved-contact notification preferences without mixing allowlists", () => {
    const listener = COMMANDS.listen as unknown as {
      flags: Record<
        string,
        { dependsOn?: string[]; exclusive?: string[]; description?: string }
      >;
      description: string;
    };
    expect(listener.flags.json).toBeDefined();
    expect(listener.flags.wake).toBeDefined();
    expect(listener.flags["hook-session"].dependsOn).toContain("wake");
    expect(listener.flags.wake.description).toContain("resumed SessionStart");
    expect(listener.flags["hook-session"].description).toContain(
      "resumed SessionStart",
    );
    expect(listener.description).toContain("primitive-hook-profile-bound-v2");
    expect(readCliPackageJson().oclif?.topics?.listen?.description).toContain(
      "--json",
    );
    expect(listener.flags.contacts.dependsOn).toContain("notify-session");
    expect(listener.flags["email-id"].dependsOn).toContain("status");
    expect(listener.flags.contacts.exclusive).toContain("sender");
    expect(listener.flags.contacts.exclusive).toContain("status");
    expect(listener.flags["contact-requests"].dependsOn).toEqual([
      "contacts",
      "notify-session",
    ]);
    expect(listener.flags["contact-requests"].exclusive).toContain("sender");
  });
  it("keeps connected waits on the existing emails wait command", () => {
    const wait = COMMANDS["emails:wait"] as unknown as {
      description: string;
      flags: Record<string, unknown>;
    };
    expect(wait.description).toContain(
      "Connected agents require --reply-to-sent-email-id",
    );
    expect(wait.description).toContain("exact-parent search");
    expect(wait.description).toContain("never scan inbox history");
    for (const flag of [
      "from",
      "to",
      "reply-to-sent-email-id",
      "since",
      "include-existing",
      "number",
      "timeout",
      "table",
    ])
      expect(wait.flags[flag]).toBeDefined();
  });
  it("keeps scoped chat discoverable under the existing command shapes", () => {
    const chat = COMMANDS.chat as unknown as {
      description: string;
      flags: Record<string, unknown>;
    };
    expect(chat.description).toContain(
      "Raw connection credentials still require --from",
    );
    expect(chat.description).toContain("share an address event receiver");
    expect(chat.flags.from).toBeDefined();
    expect(chat.flags.async).toBeDefined();
    expect(chat.description).toContain("With --async");
    expect(chat.description).toContain(
      "external Claude setup can identify its session when Bash omits the runtime",
    );
    expect(COMMANDS["chat:reply"]).toBeDefined();
  });
  it("registers canonical mailbox deletion operations", () => {
    expect(COMMANDS["sent:delete"]).toBeDefined();
    expect(COMMANDS["agent-connections:delete"]).toBeDefined();
    expect(COMMANDS["sending:delete-sent-email"]).toBeUndefined();
    expect(
      operationManifest.find((op) => op.operationId === "deleteSentEmail"),
    ).toMatchObject({ method: "DELETE", path: "/sent-emails/{id}" });
    expect(
      operationManifest.find(
        (op) => op.operationId === "removeAgentConnection",
      ),
    ).toMatchObject({
      method: "POST",
      path: "/agent-connections/{address}/remove",
    });
  });
  it("registers binary attachment part commands and metadata-index flags", () => {
    for (const id of [
      "emails:download-attachment-part",
      "sending:download-attachment-part",
    ]) {
      const command = COMMANDS[id] as unknown as {
        flags: Record<string, unknown>;
      };
      expect(command).toBeDefined();
      expect(command.flags["part-index"]).toBeDefined();
      expect(command.flags.output).toBeDefined();
      expect(command.flags.json).toBeUndefined();
      const operation = cliOperationManifest.find(
        (op) => operationCommandId(op) === id,
      );
      expect(operation?.binaryResponse).toBe(true);
      expect(
        operation?.pathParams.find(
          (parameter) => parameter.name === "part_index",
        ),
      ).toMatchObject({ minimum: 0, maximum: 2147483647, required: true });
    }
  });
  it("registers generated pull and completion operations", () => {
    expect(COMMANDS["endpoints:pull-event"]).toBeDefined();
    expect(COMMANDS["endpoints:complete-event"]).toBeDefined();
  });
  it("registers every projected operation and omits only the documented API operations", () => {
    for (const operation of cliOperationManifest)
      expect(
        COMMANDS[operationCommandId(operation)],
        operation.operationId,
      ).toBeDefined();
    const offered = new Set(
      rawCliOperationManifest.map((op) => op.operationId),
    );
    const missing = operationManifest
      .filter((op) => !offered.has(op.operationId))
      .map((op) => `${op.tagCommand}:${op.command}`);

    expect(missing.sort()).toEqual([...CLI_OMITTED_OPERATION_IDS].sort());
    expect([...CLI_OMITTED_OPERATION_IDS].sort()).toEqual(
      [
        ...KEY_WRITE_OPERATION_IDS,
        ...CREDENTIAL_HEADER_OPERATION_IDS,
        ...NOT_YET_OFFERED_OPERATION_IDS,
      ].sort(),
    );
  });

  it("offers no command yet for the email notification operations", () => {
    const ids = operationManifest
      .filter((op) => op.tagCommand === "email-notifications")
      .map((op) => `${op.tagCommand}:${op.command}`)
      .sort();
    expect(ids).toEqual([...NOT_YET_OFFERED_OPERATION_IDS].sort());
    for (const id of ids) expect(COMMANDS[id], id).toBeUndefined();
    expect(
      cliOperationManifest.some(
        (op) => op.tagCommand === "email-notifications",
      ),
    ).toBe(false);
  });

  it("offers no command for an operation that takes a credential header, and keeps its sibling", () => {
    expect(COMMANDS["emails:import-google-mail-message"]).toBeUndefined();
    expect(
      cliOperationManifest.some(
        (operation) => operation.operationId === "importGoogleMailMessage",
      ),
    ).toBe(false);
    // Each one left out declares a header the manifest marks required.
    for (const id of CREDENTIAL_HEADER_OPERATION_IDS) {
      const operation = operationManifest.find(
        (op) => `${op.tagCommand}:${op.command}` === id,
      );
      expect(operation, id).toBeDefined();
      expect(
        operation?.headerParams.some((parameter) => parameter.required),
        id,
      ).toBe(true);
    }
    expect(COMMANDS["emails:reconcile-google-mail-import"]).toBeDefined();
  });

  it("does not declare a pre-built oclif.manifest.json in package files", () => {
    // A static `oclif.manifest.json` is a snapshot captured at
    // publish time. Because COMMANDS is built dynamically from the
    // bundled `@primitivedotdev/api-core` operation manifest, a stale
    // static snapshot can advertise commands the runtime can't reach
    // or, conversely, hide commands the runtime exposes. The CLI
    // resolves commands via the dynamic COMMANDS map at runtime; the
    // static manifest must not ship with the package.
    const packageJson = readCliPackageJson();

    expect(packageJson.files ?? []).not.toContain("oclif.manifest.json");
    const prepack = packageJson.scripts?.prepack ?? "";
    expect(prepack).not.toMatch(/oclif\s+manifest/);
  });

  it("has a runtime entry specifically for functions:list-logs", () => {
    // Named regression: an AGX agent ran `primitive list-operations`,
    // saw `functions:list-logs`, and then got "command not
    // found" when invoking it. The root cause was a stale shipped
    // oclif.manifest.json; the runtime COMMANDS map always had the
    // entry. Keeping this assertion separate from the bulk coverage
    // check above makes the named-regression failure mode obvious.
    expect(COMMANDS["functions:list-logs"]).toBeDefined();
  });

  it("registers canonical task aliases for generated API operations", () => {
    for (const [alias, target] of Object.entries(CANONICAL_OPERATION_ALIASES)) {
      expect(COMMANDS[canonicalCommandId(target)]).toBeDefined();
      expect(COMMANDS[canonicalCommandId(alias)]).toBe(
        COMMANDS[canonicalCommandId(target)],
      );
    }
  });

  it("accepts --json on generated API commands that already emit JSON", () => {
    const domainsListCommand = COMMANDS["domains:list"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(domainsListCommand.flags.json).toBeDefined();
    expect(COMMANDS["domains:list-domains"]).toBeUndefined();
  });

  it("registers the top-level reply shortcut", () => {
    expect(COMMANDS.reply).toBeDefined();
  });

  it("keeps top-level chat registered with reply continuation support", () => {
    expect(COMMANDS.chat).toBeDefined();
    expect(COMMANDS["chat:reply"]).toBeDefined();
    const chatCommand = COMMANDS.chat as unknown as {
      flags: Record<string, unknown>;
    };
    const chatReplyCommand = COMMANDS["chat:reply"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(chatCommand.flags.reply).toBeDefined();
    expect(chatCommand.flags["reply-to-email-id"]).toBeDefined();
    expect(chatCommand.flags.attachment).toBeDefined();
    expect(chatCommand.flags["chat-local-id"]).toBeDefined();
    expect(chatReplyCommand.flags.id).toBeDefined();
    expect(chatReplyCommand.flags.attachment).toBeDefined();
    expect(chatReplyCommand.flags["strict-only"]).toBeDefined();
  });

  it("registers the canonical thread command", () => {
    expect(COMMANDS["threads:get"]).toBeDefined();
    expect(COMMANDS["threads:get-thread"]).toBeUndefined();
  });

  it("registers canonical agent account commands", () => {
    for (const name of ["create", "claim", "claim-verify", "claim-link"])
      expect(COMMANDS[`agent:${name}`]).toBeDefined();
  });

  it("keeps top-level send registered with attachment support", () => {
    const sendCommand = COMMANDS.send as unknown as {
      flags: Record<string, { multiple?: boolean }>;
    };
    expect(sendCommand).toBeDefined();
    expect(sendCommand.flags.attachment?.multiple).toBe(true);
  });

  it("keeps whoami registered with explicit JSON output", () => {
    expect(COMMANDS.whoami).toBeDefined();
    const whoamiCommand = COMMANDS.whoami as unknown as {
      description: string;
      flags: Record<string, unknown>;
    };
    expect(whoamiCommand.flags.json).toBeDefined();
    expect(whoamiCommand.description).toContain("identity offline");
    expect(
      (COMMANDS.chat as unknown as { description: string }).description,
    ).toContain("pinned sender address");
    expect(
      (COMMANDS["contacts:accept"] as unknown as { description: string })
        .description,
    ).toContain("safe reason code");
  });

  it("registers domain zone-file commands", () => {
    expect(COMMANDS["domains:zone-file"]).toBeDefined();
    expect(COMMANDS["domains:download-domain-zone-file"]).toBeUndefined();
    const zoneFileCommand = COMMANDS["domains:zone-file"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(zoneFileCommand.flags.id).toBeDefined();
    expect(zoneFileCommand.flags.output).toBeDefined();
    expect(zoneFileCommand.flags["outbound-only"]).toBeDefined();
  });

  it("registers the listener and its offline Python starter", () => {
    expect(COMMANDS.listen).toBeDefined();
    expect(COMMANDS["listen:init"]).toBeDefined();
    const listener = COMMANDS.listen as unknown as {
      description: string;
      flags: Record<string, unknown>;
    };
    expect(listener.description).toContain(
      "Requires a connected agent credential",
    );
    expect(listener.description).toContain("refused before any request");
    expect(listener.description).toContain(
      "external mail events at tool-output authority",
    );
    expect(listener.description).toContain("never synthetic user messages");
    expect(readCliPackageJson().oclif?.topics?.listen?.description).toContain(
      "external mail events as tool output",
    );
    for (const flag of [
      "subscription",
      "events",
      "exec",
      "forward-to",
      "number",
      "transport",
      "once",
      "timeout",
      "notify-session",
      "sender",
      "session-socket",
      "status",
      "background",
      "stop",
      "limit",
      "cursor",
    ]) {
      expect(listener.flags[flag]).toBeDefined();
    }
    const starter = COMMANDS["listen:init"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(starter.flags.language).toBeDefined();
    expect(starter.flags["out-dir"]).toBeDefined();
  });

  it("documents the shared native notification transport", () => {
    const listen = COMMANDS.listen as unknown as {
      flags: Record<string, { description: string }>;
    };
    expect(listen.flags["notify-session"].description).toContain(
      "shared WebSocket subscription",
    );
    expect(listen.flags.subscription.description).toContain(
      "generic listeners",
    );
  });
  it("registers inbox status commands", () => {
    expect(COMMANDS["inbox:setup"]).toBeDefined();
    expect(COMMANDS["inbox:status"]).toBeDefined();
    expect(COMMANDS["inbox:get-inbox-status"]).toBeUndefined();
    const inboxSetupCommand = COMMANDS["inbox:setup"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(inboxSetupCommand.flags.json).toBeDefined();
    const inboxStatusCommand = COMMANDS["inbox:status"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(inboxStatusCommand.flags.domain).toBeDefined();
    expect(inboxStatusCommand.flags.json).toBeDefined();
  });

  it("folds memory API and readable inputs into the canonical commands", () => {
    for (const verb of ["set", "get", "delete", "search"]) {
      expect(COMMANDS[`memories:${verb}`]).toHaveProperty(
        "pairedCommand",
        true,
      );
      const old = verb === "search" ? "search-memories" : `${verb}-memory`;
      expect(COMMANDS[`memories:${old}`]).toBeUndefined();
    }
  });

  it("registers template API operations", () => {
    for (const id of [
      "templates:list",
      "templates:get",
      "templates:install",
      "templates:get-install",
    ]) {
      expect(COMMANDS[id]).toBeDefined();
    }
  });

  it("registers semantic search as a top-level command", () => {
    expect(COMMANDS["semantic-search"]).toBeDefined();
    const semanticSearchCommand = COMMANDS["semantic-search"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(semanticSearchCommand.flags.mode).toBeDefined();
    expect(semanticSearchCommand.flags.corpus).toBeDefined();
    expect(semanticSearchCommand.flags["api-base-url"]).toBeDefined();
    expect(semanticSearchCommand.flags["api-base-url-1"]).toBeUndefined();
    expect(semanticSearchCommand.flags["api-base-url-2"]).toBeUndefined();
  });

  it("registers the interactive agent upgrade command", () => {
    expect(COMMANDS["agent:upgrade"]).toBeDefined();
    const cmd = COMMANDS["agent:upgrade"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(cmd.flags.email).toBeDefined();
    expect(cmd.flags.code).toBeDefined();
    expect(cmd.flags["api-key"]).toBeDefined();
  });

  it("registers signup commands", () => {
    expect(COMMANDS.signup).toBeDefined();
    expect(COMMANDS["signup:confirm"]).toBeDefined();
    expect(COMMANDS["signup:interactive"]).toBeDefined();
    expect(COMMANDS["signup:resend"]).toBeDefined();
    expect(COMMANDS["signup:status"]).toBeDefined();
    const signupStatusCommand = COMMANDS["signup:status"] as unknown as {
      flags: Record<string, unknown>;
    };
    expect(signupStatusCommand.flags.json).toBeDefined();
  });

  it("registers sign-in commands", () => {
    expect(COMMANDS.login).toBeDefined();
    expect(COMMANDS["login:browser"]).toBeDefined();
    expect(COMMANDS["login:confirm"]).toBeDefined();
    expect(COMMANDS["login:otp"]).toBeDefined();
    expect(COMMANDS["login:otp:confirm"]).toBeDefined();
    expect(COMMANDS["login:otp:resend"]).toBeDefined();
    expect(COMMANDS["login:resend"]).toBeDefined();
    expect(COMMANDS.otp).toBeDefined();
    expect(COMMANDS["otp:confirm"]).toBeDefined();
    expect(COMMANDS["otp:resend"]).toBeDefined();
    expect(COMMANDS.signin).toBeDefined();
    expect(COMMANDS["signin:browser"]).toBeDefined();
    expect(COMMANDS["signin:confirm"]).toBeDefined();
    expect(COMMANDS["signin:otp"]).toBeDefined();
    expect(COMMANDS["signin:otp:confirm"]).toBeDefined();
    expect(COMMANDS["signin:otp:resend"]).toBeDefined();
    expect(COMMANDS["signin:resend"]).toBeDefined();
  });

  it("keeps reply wait flags aligned with the reply API contract", () => {
    const replyCommand = COMMANDS.reply as unknown as {
      flags: Record<string, unknown>;
    };
    expect(replyCommand.flags.wait).toBeDefined();
    expect(replyCommand.flags.attachment).toBeDefined();
    expect(replyCommand.flags["wait-timeout-ms"]).toBeUndefined();
  });

  it("registers the canonical function test command", () => {
    expect(COMMANDS["functions:test"]).toBeDefined();
    expect(COMMANDS["functions:test-function"]).toBeUndefined();
  });

  it("registers config environment commands", () => {
    expect(COMMANDS.config).toBeDefined();
    expect(COMMANDS.config.hidden).toBe(true);
    expect(COMMANDS["config:set"]).toBeDefined();
    expect(COMMANDS["config:use"]).toBeDefined();
    expect(COMMANDS["config:list"]).toBeDefined();
    expect(COMMANDS["config:reset"]).toBeDefined();
    expect(COMMANDS["config:set"].hidden).toBeFalsy();
    expect(COMMANDS["config:use"].hidden).toBeFalsy();
    expect(COMMANDS["config:list"].hidden).toBeFalsy();
    expect(COMMANDS["config:reset"].hidden).toBeFalsy();
    for (const command of [
      COMMANDS.config,
      COMMANDS["config:set"],
      COMMANDS["config:use"],
      COMMANDS["config:list"],
      COMMANDS["config:reset"],
    ]) {
      expect(command.summary).not.toMatch(/hidden/i);
      expect(command.description ?? "").not.toMatch(/hidden/i);
    }
  });

  it("keeps the config topic out of root help", () => {
    const packageJson = readCliPackageJson();

    expect(packageJson.oclif?.topics?.config?.hidden).toBe(true);
  });

  it("documents the friendly thread command in root help", () => {
    const packageJson = readCliPackageJson();

    expect(packageJson.oclif?.topics?.threads?.description).toContain(
      "primitive threads get --id <thread-id>",
    );
  });

  it("documents template commands in root help", () => {
    const packageJson = readCliPackageJson();
    const description = packageJson.oclif?.topics?.templates?.description ?? "";

    expect(packageJson.oclif?.topicSeparator).toBe(" ");
    expect(description).toContain("primitive templates list");
    expect(description).toContain("primitive templates install");
  });

  it("documents active chat replies in root help", () => {
    const packageJson = readCliPackageJson();

    expect(packageJson.oclif?.topics?.chat?.description).toContain(
      "primitive chat reply <message>",
    );
    expect(packageJson.oclif?.topics?.chat?.description).toContain(
      "primitive chat reply <id> <message>",
    );
  });

  it("distinguishes sender domains from recipient-scope send permissions", () => {
    const packageJson = readCliPackageJson();
    const description = packageJson.oclif?.topics?.sending?.description ?? "";

    expect(description).toContain("primitive domains list");
    expect(description).toContain("usable sender domains");
    expect(description).toContain("recipient-scope");
  });

  it("configures daily update warnings", () => {
    const packageJson = readCliPackageJson();
    const updateWarning = packageJson.oclif?.["warn-if-update-available"];

    expect(packageJson.oclif?.plugins ?? []).toContain(
      "@oclif/plugin-warn-if-update-available",
    );
    expect(updateWarning?.timeoutInDays).toBe(1);
    expect(updateWarning?.frequency).toBe(1);
    expect(updateWarning?.frequencyUnit).toBe("days");
    expect(updateWarning?.message).toContain("npm install -g primitive@latest");
  });
});
