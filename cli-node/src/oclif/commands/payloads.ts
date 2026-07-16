import { Args, Command, Flags } from "@oclif/core";
import {
  type ProgressFn,
  pullFile,
  pushFile,
} from "@primitivedotdev/sdk/payloads";
import { resolveCliAuth } from "../auth.js";

const DEFAULT_API_BASE_URL = "https://api.primitive.dev";

const authFlags = {
  "api-key": Flags.string({
    description:
      "Primitive API key (defaults to PRIMITIVE_API_KEY or saved login credentials)",
    env: "PRIMITIVE_API_KEY",
  }),
  "api-base-url": Flags.string({
    description: "Override the API base URL. Internal testing only.",
    env: "PRIMITIVE_API_BASE_URL",
    hidden: true,
  }),
};

function resolveClient(
  configDir: string,
  flags: { "api-key"?: string; "api-base-url"?: string },
): { baseUrl: string; apiKey: string } {
  const auth = resolveCliAuth({
    configDir,
    apiKey: flags["api-key"],
    apiBaseUrl: flags["api-base-url"],
  });
  if (!auth.apiKey) {
    throw new Error(
      "Not authenticated: set PRIMITIVE_API_KEY, pass --api-key, or run `primitive login`.",
    );
  }
  return {
    baseUrl: auth.apiBaseUrl ?? DEFAULT_API_BASE_URL,
    apiKey: auth.apiKey,
  };
}

function progressToStderr(): ProgressFn {
  let lastPct = -1;
  return (phase, done, total) => {
    const pct = total === 0 ? 100 : Math.floor((done / total) * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      process.stderr.write(`\r${phase}: ${done}/${total} (${pct}%)   `);
      if (done === total) process.stderr.write("\n");
    }
  };
}

export class PayloadsPushCommand extends Command {
  static description =
    `Upload a file as a Primitive Payload — a large, content-addressed, end-to-end-encrypted object.

  The file is chunked and encrypted client-side and streamed up in bounded
  memory (multi-GB files never load fully into RAM). Prints the object's content
  address (merkle_root) and the hex CEK required to download it — keep the CEK
  secret; without it the object cannot be decrypted.`;

  static summary = "Stream-upload a file as an encrypted payload";
  static examples = ["<%= config.bin %> payloads push ./big-video.mp4"];

  static args = {
    file: Args.string({
      required: true,
      description: "Path to the file to upload",
    }),
  };

  static flags = {
    ...authFlags,
    concurrency: Flags.integer({
      description: "Parallel chunk uploads",
      default: 3,
    }),
    quiet: Flags.boolean({
      description: "Suppress progress output",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(PayloadsPushCommand);
    const { baseUrl, apiKey } = resolveClient(this.config.configDir, flags);
    const result = await pushFile(args.file, {
      baseUrl,
      apiKey,
      concurrency: flags.concurrency,
      onProgress: flags.quiet ? undefined : progressToStderr(),
    });
    this.log(
      JSON.stringify(
        {
          merkle_root: result.merkleRoot,
          cek: result.cek,
          chunk_count: result.chunkCount,
          total_bytes: result.totalBytes,
        },
        null,
        2,
      ),
    );
  }
}

export class PayloadsPullCommand extends Command {
  static description = `Download and decrypt a Primitive Payload to a file.

  Streams one chunk at a time, verifying each against its content address before
  decryption, so a corrupt or substituted chunk fails loudly. Requires the hex
  CEK printed by \`payloads push\`.`;

  static summary = "Stream-download and decrypt a payload to a file";
  static examples = [
    "<%= config.bin %> payloads pull <merkle_root> --cek <hex> --out ./restored.mp4",
  ];

  static args = {
    root: Args.string({
      required: true,
      description: "Object content address (merkle_root)",
    }),
  };

  static flags = {
    ...authFlags,
    out: Flags.string({ required: true, description: "Output file path" }),
    cek: Flags.string({
      required: true,
      description: "Hex content-encryption key from `payloads push`",
    }),
    quiet: Flags.boolean({
      description: "Suppress progress output",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(PayloadsPullCommand);
    const { baseUrl, apiKey } = resolveClient(this.config.configDir, flags);
    const manifest = await pullFile(args.root, flags.out, {
      baseUrl,
      apiKey,
      cek: flags.cek,
      onProgress: flags.quiet ? undefined : progressToStderr(),
    });
    this.log(
      JSON.stringify(
        {
          merkle_root: args.root,
          out: flags.out,
          chunk_count: manifest.chunkCount,
          total_bytes: manifest.totalPlaintextSize,
        },
        null,
        2,
      ),
    );
  }
}
