import { describe, expect, it } from "vitest";
import {
  parseFromHeader,
  parseFromHeaderLoose,
} from "../../src/parser/address-parser.js";

describe("parseFromHeader (strict)", () => {
  describe("happy path", () => {
    it("parses bare address", () => {
      const r = parseFromHeader("user@example.com");
      expect(r).toEqual({
        ok: true,
        value: { address: "user@example.com" },
      });
    });

    it("extracts the address from a display-name + angle-bracket form", () => {
      const r = parseFromHeader("Plain Name <user@example.com>");
      expect(r).toEqual({
        ok: true,
        value: { address: "user@example.com" },
      });
    });

    it("extracts the address from a quoted display name", () => {
      const r = parseFromHeader('"Quoted Name" <user@example.com>');
      expect(r).toEqual({
        ok: true,
        value: { address: "user@example.com" },
      });
    });

    it("extracts the address with no display name", () => {
      const r = parseFromHeader("<user@example.com>");
      expect(r).toEqual({
        ok: true,
        value: { address: "user@example.com" },
      });
    });

    it("extracts the address from an RFC 2047 encoded-word display name", () => {
      const r = parseFromHeader("=?utf-8?B?5pel5pys?= <user@example.com>");
      expect(r).toEqual({
        ok: true,
        value: { address: "user@example.com" },
      });
    });

    it("extracts the address when display name contains angle brackets", () => {
      const r = parseFromHeader('"Re: <ticket>" <user@example.com>');
      expect(r).toEqual({
        ok: true,
        value: { address: "user@example.com" },
      });
    });

    it("lowercases both local-part and domain", () => {
      const r = parseFromHeader("User <USER@Example.COM>");
      expect(r).toEqual({
        ok: true,
        value: { address: "user@example.com" },
      });
    });

    it("preserves plus-tag in the local-part as a literal character", () => {
      // Strict literal matching: gate sites compare exact addresses.
      // Plus-aliasing is a receive-side convention; senders almost never
      // get to choose the From's local-part.
      const r = parseFromHeader("Joe <joe+work@example.com>");
      expect(r).toEqual({
        ok: true,
        value: { address: "joe+work@example.com" },
      });
    });

    it("trims surrounding whitespace before parsing", () => {
      const r = parseFromHeader("   user@example.com   ");
      expect(r).toEqual({
        ok: true,
        value: { address: "user@example.com" },
      });
    });

    it("accepts a normal-size SMTPUTF8 address with multi-byte chars", () => {
      // Locks in that byte-counted length checks do not false-reject
      // realistic internationalized addresses. 5 chars of 3 bytes each
      // plus '@example.com' is 27 bytes total, well under both caps.
      const r = parseFromHeader("用户名 <用户名@example.com>");
      expect(r).toEqual({
        ok: true,
        value: { address: "用户名@example.com" },
      });
    });

    it("accepts an IPv4 address literal in the domain", () => {
      // RFC 5321 §4.1.3 allows [IPv4] address literals in the domain
      // part. The dot/leading-dot/trailing-dot domain checks must not
      // reject the [n.n.n.n] form, which legitimately contains dots
      // but is bracketed.
      const r = parseFromHeader("user@[192.168.1.1]");
      expect(r).toEqual({
        ok: true,
        value: { address: "user@[192.168.1.1]" },
      });
    });

    it("accepts trailing junk but does not surface it (no name field)", () => {
      // Strict drops the name field entirely, so addressparser's
      // recovery (`name: "extra"` from `user@example.com extra`) cannot
      // leak into the result. The address is correct, which is what the
      // gate decision needs; the trailing token is silently discarded.
      const r = parseFromHeader("user@example.com extra");
      expect(r).toEqual({
        ok: true,
        value: { address: "user@example.com" },
      });
    });

    it("ignores a second bracketed address that addressparser folds into the name", () => {
      // For input like `Name <user@x.com> <attacker@y.com>`, addressparser
      // returns one entry whose name is `Name attacker@y.com`. The name is
      // never surfaced by strict, so the address-confusion vector is
      // closed: the gate sees only `user@x.com`, which is what the
      // canonical From-header parse defines as the sender identity.
      const r = parseFromHeader(
        "Name <user@example.com> <attacker@example.net>",
      );
      expect(r).toEqual({
        ok: true,
        value: { address: "user@example.com" },
      });
    });

    it("ignores an embedded CRLF in a quoted display name", () => {
      // addressparser collapses CR/LF in quoted strings to spaces and
      // strict drops the name anyway, so a header-injection attempt via
      // the name field cannot survive into the result.
      const r = parseFromHeader('"Name\r\n Bcc: x" <user@example.com>');
      expect(r).toEqual({
        ok: true,
        value: { address: "user@example.com" },
      });
    });
  });

  describe("rejection paths", () => {
    it("rejects null", () => {
      expect(parseFromHeader(null)).toEqual({ ok: false, reason: "empty" });
    });

    it("rejects undefined", () => {
      expect(parseFromHeader(undefined)).toEqual({
        ok: false,
        reason: "empty",
      });
    });

    it("rejects empty string", () => {
      expect(parseFromHeader("")).toEqual({ ok: false, reason: "empty" });
    });

    it("rejects whitespace-only", () => {
      expect(parseFromHeader("   \t\n  ")).toEqual({
        ok: false,
        reason: "empty",
      });
    });

    it("rejects headers longer than 998 octets", () => {
      const huge = `${"a".repeat(1000)}@example.com`;
      expect(parseFromHeader(huge)).toEqual({
        ok: false,
        reason: "too_long",
      });
    });

    it("rejects headers over 998 bytes when chars alone are under the cap", () => {
      // 'é' is one JS code unit but two UTF-8 bytes. 600 of them is 600
      // chars but 1200 bytes, so a char-counted check would let it pass
      // while a byte-counted check correctly rejects it.
      const huge = "é".repeat(600);
      expect(parseFromHeader(huge)).toEqual({
        ok: false,
        reason: "too_long",
      });
    });

    it("rejects multi-address From", () => {
      expect(parseFromHeader("a@example.com, b@example.com")).toEqual({
        ok: false,
        reason: "multiple_addresses",
      });
    });

    it("rejects group syntax", () => {
      expect(parseFromHeader("Friends: a@b.com, c@d.com;")).toEqual({
        ok: false,
        reason: "group_syntax",
      });
    });

    it("rejects an empty group", () => {
      expect(parseFromHeader("Empty:;")).toEqual({
        ok: false,
        reason: "group_syntax",
      });
    });

    it("rejects a string with no recognizable address", () => {
      // addressparser returns a single entry with empty address for raw
      // garbage; the address-shape check rejects it as invalid_address.
      expect(parseFromHeader("garbage")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects address with two @-signs", () => {
      expect(parseFromHeader("a@b@c.com")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects address with empty local-part", () => {
      expect(parseFromHeader("@example.com")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects address with empty domain", () => {
      expect(parseFromHeader("user@")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects address with bare domain (no dot)", () => {
      expect(parseFromHeader("user@localhost")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects address with leading dot in domain", () => {
      expect(parseFromHeader("user@.example.com")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects address with trailing dot in domain", () => {
      expect(parseFromHeader("user@example.com.")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects address with consecutive dots in domain", () => {
      expect(parseFromHeader("user@example..com")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects address whose addr-spec exceeds 320 octets", () => {
      // Long enough to be a clearly invalid address but still under the
      // 998-octet header cap so it reaches the address-shape check.
      const local = "a".repeat(310);
      const r = parseFromHeader(`Display <${local}@example.com>`);
      expect(r).toEqual({ ok: false, reason: "invalid_address" });
    });

    it("rejects addr-spec over 320 bytes when chars alone are under the cap", () => {
      // 200 'é' chars in the local-part is 200 JS code units but 400
      // UTF-8 bytes, so the addr-spec is well over 320 bytes while
      // staying under 320 chars.
      const local = "é".repeat(200);
      const r = parseFromHeader(`Display <${local}@example.com>`);
      expect(r).toEqual({ ok: false, reason: "invalid_address" });
    });

    it("rejects local-part with leading dot", () => {
      expect(parseFromHeader(".user@example.com")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects local-part with trailing dot", () => {
      expect(parseFromHeader("user.@example.com")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects local-part with consecutive dots", () => {
      expect(parseFromHeader("us..er@example.com")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects domain label with leading hyphen", () => {
      expect(parseFromHeader("user@-example.com")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects domain label with trailing hyphen", () => {
      expect(parseFromHeader("user@example-.com")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });

    it("rejects underscore in domain label", () => {
      expect(parseFromHeader("user@example_com.com")).toEqual({
        ok: false,
        reason: "invalid_address",
      });
    });
  });
});

describe("parseFromHeaderLoose", () => {
  it("parses bare address", () => {
    expect(parseFromHeaderLoose("user@example.com")).toEqual({
      address: "user@example.com",
      name: null,
    });
  });

  it("parses display name + address", () => {
    expect(parseFromHeaderLoose("Plain Name <user@example.com>")).toEqual({
      address: "user@example.com",
      name: "Plain Name",
    });
  });

  it("returns null for null", () => {
    expect(parseFromHeaderLoose(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseFromHeaderLoose(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseFromHeaderLoose("")).toBeNull();
  });

  it("returns null for whitespace-only", () => {
    expect(parseFromHeaderLoose("   ")).toBeNull();
  });

  it("returns null for over-long input", () => {
    expect(parseFromHeaderLoose(`${"a".repeat(1000)}@example.com`)).toBeNull();
  });

  it("returns null when bytes exceed the cap even if chars do not", () => {
    // Mirror of the strict-path test. 'é' is one JS code unit but two
    // UTF-8 bytes, so 600 chars is 1200 bytes.
    expect(parseFromHeaderLoose("é".repeat(600))).toBeNull();
  });

  it("returns the FIRST address from a multi-address header", () => {
    expect(parseFromHeaderLoose("a@example.com, b@example.com")).toEqual({
      address: "a@example.com",
      name: null,
    });
  });

  it("flattens group syntax and returns the first member", () => {
    expect(parseFromHeaderLoose("Friends: a@b.com, c@d.com;")).toEqual({
      address: "a@b.com",
      name: null,
    });
  });

  it("returns null when the parsed address fails shape validation", () => {
    expect(parseFromHeaderLoose("garbage")).toBeNull();
    expect(parseFromHeaderLoose("@example.com")).toBeNull();
    expect(parseFromHeaderLoose("user@")).toBeNull();
    expect(parseFromHeaderLoose("user@localhost")).toBeNull();
  });

  it("lowercases the address", () => {
    expect(parseFromHeaderLoose("USER@Example.COM")).toEqual({
      address: "user@example.com",
      name: null,
    });
  });
});
