import { readFileSync } from "node:fs";
import { Command, Flags } from "@oclif/core";
import type { X402Challenge } from "@primitivedotdev/sdk/x402";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  runWithTiming,
  TIME_FLAG_DESCRIPTION,
} from "../api-command.js";
import {
  buildX402Client,
  explorerTxUrl,
  PRIVATE_KEY_ENV,
  PRIVATE_KEY_FLAG_DESCRIPTION,
  reportX402Error,
  signerFromPrivateKey,
} from "./payments-shared.js";

// `primitive payments pay` is the payer side of an x402 payment. The payee
// hands you a challenge object (the full JSON from `payments create-challenge`,
// typically delivered out of band, e.g. in an email); this command signs the
// bound EIP-3009 authorization locally with your wallet key and submits it for
// settlement. The auto-generated wrapper for the pay operation is overridden
// because its wire body is a signed payload the user cannot produce by hand.

export function readChallenge(input: {
  inline?: string;
  file?: string;
}): X402Challenge {
  let raw: string;
  if (input.inline !== undefined) {
    raw = input.inline;
  } else if (input.file !== undefined) {
    raw = readFileSync(input.file, "utf8");
  } else {
    // Default to stdin so a challenge can be piped:
    //   primitive payments create-challenge ... | primitive payments pay
    raw = readFileSync(0, "utf8");
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(
      "no challenge provided; pass --challenge '<json>', --challenge-file <path>, or pipe the challenge JSON on stdin",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("challenge is not valid JSON");
  }
  // Accept either the bare challenge object or a `{ data: { ... } }` envelope so
  // the output of `payments create-challenge` can be piped straight in.
  if (parsed && typeof parsed === "object" && "data" in parsed) {
    return (parsed as { data: X402Challenge }).data;
  }
  return parsed as X402Challenge;
}

class PaymentsPayCommand extends Command {
  static description = `Pay an x402 payment challenge.

  Reads the challenge object the payee gave you, derives and signs the
  interaction-bound EIP-3009 authorization locally with your wallet key (read
  from ${PRIVATE_KEY_ENV} by default), and submits it for non-custodial
  on-chain settlement. The key never leaves your machine. Provide the challenge
  inline with --challenge, from a file with --challenge-file, or piped on stdin.`;

  static summary = "Sign and settle an x402 payment challenge";

  static examples = [
    "<%= config.bin %> payments pay --challenge-file challenge.json",
    '<%= config.bin %> payments pay --challenge \'{"id":"...","network":"base-sepolia",...}\'',
    "cat challenge.json | <%= config.bin %> payments pay",
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
      description: "The challenge object as a JSON string.",
      exclusive: ["challenge-file"],
    }),
    "challenge-file": Flags.string({
      description: "Path to a file containing the challenge JSON.",
      exclusive: ["challenge"],
    }),
    json: Flags.boolean({
      description: "Print the raw receipt JSON instead of a human summary.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PaymentsPayCommand);

    const { auth, baseUrlOverridden, requestConfig } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const client = buildX402Client({
        apiKey: auth.apiKey,
        resolvedApiBaseUrl: requestConfig.resolvedApiBaseUrl,
      });
      if (!client) {
        process.exitCode = 1;
        return;
      }

      try {
        const challenge = readChallenge({
          inline: flags.challenge,
          file: flags["challenge-file"],
        });
        const signer = signerFromPrivateKey(flags["private-key"] ?? "");
        const receipt = await client.pay(challenge, { signer });
        if (flags.json) {
          this.log(JSON.stringify(receipt, null, 2));
          return;
        }
        if (receipt.status === "settled" && receipt.settle_tx) {
          this.log(`Payment settled. Transaction: ${receipt.settle_tx}`);
          const url = explorerTxUrl(challenge.network, receipt.settle_tx);
          if (url) this.log(url);
        } else {
          this.log(`Payment ${receipt.status}.`);
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

export default PaymentsPayCommand;
