import { readFileSync } from "node:fs";
import { Command, Flags } from "@oclif/core";
import type { X402EmailChallenge } from "@primitivedotdev/sdk/x402";
import { resolveCliApiRequestConfig } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  runWithTiming,
  TIME_FLAG_DESCRIPTION,
} from "../api-command.js";
import type { ResolvedCliAuth } from "../auth.js";
import {
  PRIVATE_KEY_ENV,
  PRIVATE_KEY_FLAG_DESCRIPTION,
  reportX402Error,
  signEmailChallenge,
} from "./payments-shared.js";

// `primitive payments pay-email-step` is the payer side of an email-native
// x402 payment. The payee issues a challenge over an email thread (via
// `payments create-email-challenge`) and you receive the challenge JSON. This
// command signs the interaction-bound EIP-3009 authorization locally with your
// wallet key and emits the signed `interaction.json` payment-step envelope.
//
// It does NOT send anything: you attach the printed envelope as the
// `interaction.json` part of your reply to the challenge email (e.g. with
// `primitive reply --attachment interaction.json`). This mirrors the
// hand-rolled `payments pay` command's key handling, but produces a portable
// signed artifact instead of submitting to a synthetic-challenge endpoint.

export function readEmailChallenge(input: {
  inline?: string;
  file?: string;
}): X402EmailChallenge {
  let raw: string;
  if (input.inline !== undefined) {
    raw = input.inline;
  } else if (input.file !== undefined) {
    raw = readFileSync(input.file, "utf8");
  } else {
    // Default to stdin so a challenge can be piped:
    //   primitive payments create-email-challenge ... | primitive payments pay-email-step
    // On an interactive TTY (no pipe) readFileSync(0) blocks silently waiting
    // for EOF, so print a hint first the way `jq` does.
    if (process.stdin.isTTY) {
      process.stderr.write(
        "Reading the email challenge JSON from stdin; paste it and press Ctrl-D (or use --challenge / --challenge-file).\n",
      );
    }
    raw = readFileSync(0, "utf8");
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(
      "no challenge provided; pass --challenge '<json>', --challenge-file <path>, or pipe the email challenge JSON on stdin",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("challenge is not valid JSON");
  }
  // Accept either the bare email-challenge object or a `{ data: { ... } }`
  // envelope so the output of `payments create-email-challenge` can be piped
  // straight in. Guard against a null/non-object `data` (e.g. `{"data":null}`)
  // so it fails here with a clear message instead of surfacing a confusing
  // downstream crash when the SDK reads the (missing) challenge fields.
  if (parsed && typeof parsed === "object" && "data" in parsed) {
    const data = (parsed as { data: unknown }).data;
    if (!data || typeof data !== "object") {
      throw new Error(
        'challenge envelope has no `data` object; pass the email challenge JSON itself or a `{ "data": { ... } }` envelope',
      );
    }
    return data as X402EmailChallenge;
  }
  return parsed as X402EmailChallenge;
}

class PaymentsPayEmailStepCommand extends Command {
  static description =
    `Sign an email-native x402 challenge into a payment-step interaction.json.

  Reads the email challenge the payee issued (the JSON from
  \`payments create-email-challenge\`), derives and signs the interaction-bound
  EIP-3009 authorization locally with your wallet key (read from
  ${PRIVATE_KEY_ENV} by default), and prints the signed \`interaction.json\`
  payment-step envelope. The key never leaves your machine.

  This command does NOT send the payment. Attach the printed envelope as the
  \`interaction.json\` part of your reply to the challenge email, for example:
    primitive payments pay-email-step --challenge-file challenge.json > interaction.json
    primitive reply --attachment interaction.json

  Provide the challenge inline with --challenge, from a file with
  --challenge-file, or piped on stdin.`;

  static summary = "Sign an email x402 challenge into a payment-step envelope";

  static examples = [
    "<%= config.bin %> payments pay-email-step --challenge-file challenge.json > interaction.json",
    '<%= config.bin %> payments pay-email-step --challenge \'{"interaction_id":"...","challenge":{...}}\'',
    "cat challenge.json | <%= config.bin %> payments pay-email-step",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description: API_BASE_URL_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    "private-key": Flags.string({
      description: PRIVATE_KEY_FLAG_DESCRIPTION,
      env: PRIVATE_KEY_ENV,
    }),
    challenge: Flags.string({
      description: "The email challenge object as a JSON string.",
      exclusive: ["challenge-file"],
    }),
    "challenge-file": Flags.string({
      description: "Path to a file containing the email challenge JSON.",
      exclusive: ["challenge"],
    }),
    json: Flags.boolean({
      description:
        "Print the full signed envelope object (default prints the interaction.json bytes).",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PaymentsPayEmailStepCommand);

    // `payEmailChallenge` is fully local (no network call), so this command
    // deliberately does NOT authenticate: a payer with a wallet key and a
    // received challenge can sign even when not signed in to Primitive (or with
    // an expired stored login). Resolve only the request config for the base
    // URL; do not build the authenticated client, which can throw when stored
    // credentials are expired/malformed and would block the offline signer.
    const requestConfig = resolveCliApiRequestConfig({
      apiBaseUrl: flags["api-base-url"],
      configDir: this.config.configDir,
    });
    const baseUrlOverridden = requestConfig.baseUrlOverridden;
    // A synthetic "no credentials" auth so the shared error reporter stays a
    // no-op for the unauthorized hint (this path never makes a request that
    // could 401).
    const auth: ResolvedCliAuth = {
      apiKey: flags["api-key"],
      apiBaseUrl: requestConfig.resolvedApiBaseUrl,
      source: "none",
      credentials: null,
    };

    await runWithTiming(flags.time, async () => {
      try {
        const challenge = readEmailChallenge({
          inline: flags.challenge,
          file: flags["challenge-file"],
        });
        const built = await signEmailChallenge({
          challenge,
          privateKey: flags["private-key"] ?? "",
          resolvedApiBaseUrl: requestConfig.resolvedApiBaseUrl,
          apiKey: flags["api-key"],
        });
        if (flags.json) {
          this.log(JSON.stringify(built.envelope, null, 2));
        } else {
          // The canonical interaction.json bytes: what to attach to the reply.
          this.log(built.json);
        }
      } catch (error) {
        reportX402Error(error, {
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
        });
        process.exitCode = 1;
      }
    });
  }
}

export default PaymentsPayEmailStepCommand;
