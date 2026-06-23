import { Command, Flags } from "@oclif/core";
import { getAccount } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import {
  buildX402Client,
  PRIVATE_KEY_ENV,
  PRIVATE_KEY_FLAG_DESCRIPTION,
  reportX402Error,
  signerFromPrivateKey,
} from "./payments-shared.js";

// `primitive payments register-payout-address` is the first step of collecting
// x402 payments: it proves you control a payout address and registers it as the
// default destination for a network. `createChallenge` (auto-generated as
// `payments create-challenge`) resolves its `pay_to` from this directory, so a
// payee that has not registered an address cannot be paid. The auto-generated
// wrapper for this operation is overridden because the wire request carries an
// ownership signature the user cannot produce by hand; this command signs it
// locally with the wallet key (never sent to Primitive).

class PaymentsRegisterPayoutAddressCommand extends Command {
  static description =
    `Register the default payout address your org receives x402 payments at.

  Proves control of the address by signing an org-bound message locally with
  your wallet key (read from ${PRIVATE_KEY_ENV} by default), then registers the
  recovered address as the default for the chosen network. Registering again
  replaces the existing default. Run this before \`payments create-challenge\`.`;

  static summary = "Register a payout address for receiving x402 payments";

  static examples = [
    "<%= config.bin %> payments register-payout-address",
    "<%= config.bin %> payments register-payout-address --network base --label treasury",
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
    network: Flags.string({
      description: "Chain the address receives on.",
      options: ["base", "base-sepolia"],
      default: "base-sepolia",
    }),
    label: Flags.string({
      description: "Optional human-readable label for the address.",
    }),
    "issued-at": Flags.string({
      description:
        "ISO-8601 timestamp embedded in the signed message. Defaults to now. Must be within ~10 minutes of server time.",
    }),
    json: Flags.boolean({
      description:
        "Print the raw payout-address JSON instead of a human summary.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PaymentsRegisterPayoutAddressCommand);

    const { apiClient, auth, baseUrlOverridden, requestConfig } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      // The signed ownership message binds the org id, which the server
      // recomputes from the authenticated key. Resolve it from /account so the
      // signed bytes match what the verifier rebuilds.
      const account = await getAccount({
        client: apiClient.client,
        responseStyle: "fields",
      });
      if (account.error) {
        const payload = extractErrorPayload(account.error);
        writeErrorWithHints(payload);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload,
        });
        process.exitCode = 1;
        return;
      }
      const org = (account.data as { data: { id: string } }).data.id;

      const client = buildX402Client({
        apiKey: auth.apiKey,
        resolvedApiBaseUrl: requestConfig.resolvedApiBaseUrl,
      });
      if (!client) {
        process.exitCode = 1;
        return;
      }

      try {
        const signer = signerFromPrivateKey(flags["private-key"] ?? "");
        const result = await client.registerPayoutAddress(
          {
            org,
            network: flags.network,
            ...(flags["issued-at"] ? { issuedAt: flags["issued-at"] } : {}),
            ...(flags.label ? { label: flags.label } : {}),
          },
          { signer },
        );
        if (flags.json) {
          this.log(JSON.stringify(result, null, 2));
        } else {
          this.log(
            `Registered ${result.address} as the default payout address for ${result.network}. You can now run \`primitive payments charge\`.`,
          );
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

export default PaymentsRegisterPayoutAddressCommand;
