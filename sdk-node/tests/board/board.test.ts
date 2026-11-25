import { afterEach, describe, expect, it } from "vitest";
import {
  board,
  primitiveBoardUrl,
  setBoardEnvironment,
} from "../../src/board/index.js";

describe("primitiveBoardUrl", () => {
  it("is the board under the production API by default", () => {
    expect(primitiveBoardUrl()).toBe("https://api.primitive.dev/v1/board");
  });

  it("follows the API base URL of the environment", () => {
    expect(primitiveBoardUrl("https://api.example.test/v1/")).toBe(
      "https://api.example.test/v1/board",
    );
  });

  it("rejects a base that is not an http(s) URL", () => {
    expect(() => primitiveBoardUrl("api.primitive.dev")).toThrow(
      /http\(s\) URL/,
    );
  });
});

describe("setBoardEnvironment", () => {
  it("points @vercel/board at the Primitive board with the credential", () => {
    const env: Record<string, string | undefined> = {
      BOARD_NAME: "security",
      BOARD_TOKEN: "someone-elses",
    };
    const url = setBoardEnvironment(
      { apiKey: "prim_key", apiBaseUrl: "https://api.example.test/v1" },
      env,
    );
    expect(url).toBe("https://api.example.test/v1/board");
    expect(env).toEqual({
      BOARD_URL: "https://api.example.test/v1/board",
      BOARD_TOKEN: "prim_key",
    });
  });

  it("falls back to PRIMITIVE_API_KEY and PRIMITIVE_API_BASE_URL", () => {
    const env: Record<string, string | undefined> = {
      PRIMITIVE_API_KEY: "prim_env",
      PRIMITIVE_API_BASE_URL: "https://api.example.test/v1",
    };
    setBoardEnvironment({}, env);
    expect(env.BOARD_URL).toBe("https://api.example.test/v1/board");
    expect(env.BOARD_TOKEN).toBe("prim_env");
  });

  it("requires a credential and leaves the environment alone without one", () => {
    const env: Record<string, string | undefined> = {};
    expect(() => setBoardEnvironment({}, env)).toThrow(/PRIMITIVE_API_KEY/);
    expect(env).toEqual({});
  });
});

describe("board", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("returns a handle on the Primitive board", () => {
    const handle = board({
      apiKey: "prim_key",
      apiBaseUrl: "https://api.example.test/v1",
    });
    expect(process.env.BOARD_URL).toBe("https://api.example.test/v1/board");
    expect(typeof handle.post).toBe("function");
    expect(typeof handle.fetch).toBe("function");
  });
});
