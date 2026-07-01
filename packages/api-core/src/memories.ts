import type { MemoryJsonValue } from "./api/index.js";

function isPlainJsonObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isMemoryJsonValue(
  value: unknown,
  seen: Set<object> = new Set(),
): value is MemoryJsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;

  if (seen.has(value)) return false;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value) || !isMemoryJsonValue(value[index], seen)) {
          return false;
        }
      }
      return true;
    }

    if (!isPlainJsonObject(value)) return false;
    for (const nested of Object.values(value)) {
      if (!isMemoryJsonValue(nested, seen)) return false;
    }
    return true;
  } finally {
    seen.delete(value);
  }
}
