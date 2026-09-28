export type ContactRuleSelector = {
  kind: "address" | "domain" | "pattern";
  value: string;
};

const localPart =
  /^[a-z0-9!#$%&'+/=^_`{|}~-]+(?:\.[a-z0-9!#$%&'+/=^_`{|}~-]+)*$/;
const patternPart = /^[a-z0-9.!#$%&'+/=^_`{|}~*-]+$/;
const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function domain(value: string): boolean {
  const labels = value.split(".");
  return (
    value.length <= 253 &&
    labels.length >= 2 &&
    labels.every((part) => label.test(part)) &&
    /[a-z]/.test(labels.at(-1) ?? "")
  );
}

function domainPattern(value: string): boolean {
  return domain(value.startsWith("*.") ? value.slice(2) : value);
}

function splitAddress(value: string): [string, string] | null {
  const parts = value.split("@");
  const [local, host] = parts;
  return parts.length === 2 && local && host ? [local, host] : null;
}

/** Restricted selectors are canonical data, never regular expressions. */
export function canonicalContactSelector(
  input: ContactRuleSelector,
): ContactRuleSelector {
  const value = input.value.trim().toLowerCase();
  const invalid = () => new Error("Invalid contact approval selector.");
  if (!value || value.length > 254) throw invalid();
  if (input.kind === "domain") {
    if (!domainPattern(value)) throw invalid();
    return { kind: input.kind, value };
  }
  const parts = splitAddress(value);
  if (!parts) throw invalid();
  const [local, host] = parts;
  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..")
  )
    throw invalid();
  if (input.kind === "address") {
    if (!localPart.test(local) || !domain(host)) throw invalid();
  } else if (input.kind === "pattern") {
    if (
      !patternPart.test(local) ||
      (local !== "*" &&
        !localPart.test(local.endsWith("*") ? local.slice(0, -1) : local)) ||
      !domainPattern(host) ||
      (local.includes("*") &&
        (!local.endsWith("*") || local.slice(0, -1).includes("*")))
    )
      throw invalid();
  } else throw invalid();
  return { kind: input.kind, value };
}

function matchesDomain(pattern: string, value: string): boolean {
  if (!pattern.startsWith("*.")) return pattern === value;
  const suffix = pattern.slice(1);
  return value.length > suffix.length && value.endsWith(suffix);
}

// Only a terminal local wildcard is supported. It cannot cross the @ boundary.
function matchesLocal(pattern: string, value: string): boolean {
  return pattern.endsWith("*")
    ? value.startsWith(pattern.slice(0, -1))
    : value === pattern;
}

export function matchesContactPattern(
  pattern: string,
  sender: string,
): boolean {
  return matchesContactSelector({ kind: "pattern", value: pattern }, sender);
}

/** Malformed sender identities never match; malformed stored rules fail closed. */
export function matchesContactSelector(
  input: ContactRuleSelector,
  sender: string,
): boolean {
  const selector = canonicalContactSelector(input);
  let address: string;
  try {
    address = canonicalContactSelector({
      kind: "address",
      value: sender,
    }).value;
  } catch {
    return false;
  }
  if (selector.kind === "address") return selector.value === address;
  const [local, host] = splitAddress(address) ?? [];
  if (!local || !host) return false;
  if (selector.kind === "domain") return matchesDomain(selector.value, host);
  const [localPattern, hostPattern] = splitAddress(selector.value) ?? [];
  return Boolean(
    localPattern &&
      hostPattern &&
      matchesDomain(hostPattern, host) &&
      matchesLocal(localPattern, local),
  );
}
