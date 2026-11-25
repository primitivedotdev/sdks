/**
 * `@primitivedotdev/sdk/board`: a Board handle (`@vercel/board`) on the
 * Primitive board for your environment, authenticated with your Primitive
 * credential.
 *
 * ```ts
 * import { board } from "@primitivedotdev/sdk/board";
 *
 * const team = board({ apiKey: process.env.PRIMITIVE_API_KEY });
 * await team.post("dev", { text: "ready to promote?" });
 * ```
 *
 * @packageDocumentation
 */
import {
  type Board,
  type BoardOptions,
  board as boardAtEnvironment,
} from "@vercel/board";

export type { Board } from "@vercel/board";

/** The production Primitive API, which the board lives under. */
export const DEFAULT_API_BASE_URL = "https://api.primitive.dev/v1";

/** The board under a Primitive API base URL: `https://api.primitive.dev/v1/board` for production. */
export function primitiveBoardUrl(
  apiBaseUrl: string = DEFAULT_API_BASE_URL,
): string {
  const base = apiBaseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^/]/.test(base)) {
    throw new Error(
      `Primitive API base URL must be an http(s) URL, got ${JSON.stringify(apiBaseUrl)}.`,
    );
  }
  return `${base}/board`;
}

export type PrimitiveBoardCredentials = {
  /** A Primitive API key or OAuth access token. Defaults to `PRIMITIVE_API_KEY`. */
  apiKey?: string;
  /** The Primitive API base URL. Defaults to `PRIMITIVE_API_BASE_URL`, then production. */
  apiBaseUrl?: string;
};

type Env = Record<string, string | undefined>;

/**
 * Points `@vercel/board` at the Primitive board and sends `apiKey` to it:
 * sets `BOARD_URL` and `BOARD_TOKEN` in `env`, which is how `@vercel/board`
 * reaches a board at a URL from Node. It removes `BOARD_NAME`, which names a
 * Vercel team's board and conflicts with `BOARD_URL`. One process acts for
 * one Primitive credential at a time. Returns the board URL.
 */
export function setBoardEnvironment(
  credentials: PrimitiveBoardCredentials = {},
  env: Env = process.env,
): string {
  const apiKey = (credentials.apiKey ?? env.PRIMITIVE_API_KEY)?.trim();
  if (!apiKey) {
    throw new Error(
      "A Primitive credential is required for the board: pass apiKey or set PRIMITIVE_API_KEY.",
    );
  }
  const url = primitiveBoardUrl(
    credentials.apiBaseUrl ?? (env.PRIMITIVE_API_BASE_URL || undefined),
  );
  env.BOARD_URL = url;
  env.BOARD_TOKEN = apiKey;
  delete env.BOARD_NAME;
  return url;
}

export type PrimitiveBoardOptions = PrimitiveBoardCredentials &
  Omit<BoardOptions, "backend" | "fetch" | "team" | "name" | "ensure">;

/**
 * The Primitive board for your environment, as a `@vercel/board` handle:
 * every method of `Board` (post, read, tasks, grants, events) acts as the
 * holder of `apiKey`. See {@link setBoardEnvironment} for how it is wired.
 */
export function board(options: PrimitiveBoardOptions = {}): Board {
  const { apiKey, apiBaseUrl, ...rest } = options;
  setBoardEnvironment({ apiKey, apiBaseUrl });
  return boardAtEnvironment(rest);
}
