/**
 * A typed builder for the `grant` of `createKey` and `updateKey`.
 *
 * The output is the wire shape (`KeyGrant`): either a preset name or a
 * `KeyGrantSpec` object. Permissions are typed as the generated `Permission`
 * union, so a typo is a compile error; the server still decides what the
 * caller may give and adds the permissions a choice implies (returned as
 * `warnings`).
 *
 * @example
 *   GrantSpec.preset("send_only").build();
 *   GrantSpec.custom()
 *     .allow("mail:read", "mail:send")
 *     .addresses("support@example.com")
 *     .build();
 */
import type { KeyGrant, KeyGrantSpec, KeyPreset } from "./api/index.js";
import {
  PERMISSIONS,
  type Permission,
} from "./openapi/permissions.generated.js";

/** A level in the per-area permission matrix of `GET /keys/builder`. */
export type GrantSpecMatrixLevel = "none" | "read" | "write";

const KNOWN_PERMISSIONS: ReadonlySet<string> = new Set(PERMISSIONS);
const RESOURCE_TYPES = ["function", "domain", "endpoint", "route"] as const;
type ResourceType = (typeof RESOURCE_TYPES)[number];

function uniquePush(target: string[], values: readonly string[]): void {
  for (const value of values) {
    if (!target.includes(value)) target.push(value);
  }
}

export class GrantSpec {
  readonly #preset: KeyPreset;
  readonly #permissions: string[] = [];
  readonly #addresses: string[] = [];
  readonly #domains: string[] = [];
  readonly #matrix: Record<string, GrantSpecMatrixLevel> = {};
  readonly #resources: Partial<Record<ResourceType, string[]>> = {};

  private constructor(preset: KeyPreset) {
    this.#preset = preset;
  }

  /** Start from a preset, such as `send_only` or `read_only`. */
  static preset(preset: KeyPreset): GrantSpec {
    return new GrantSpec(preset);
  }

  /** Start a custom grant. Add permissions with `allow` or `matrix`. */
  static custom(): GrantSpec {
    return new GrantSpec("custom");
  }

  /** True for a permission this SDK version knows. The server may know more. */
  static isPermission(value: string): value is Permission {
    return KNOWN_PERMISSIONS.has(value);
  }

  /** Add permissions to a custom grant. */
  allow(...permissions: Permission[]): this {
    uniquePush(this.#permissions, permissions);
    return this;
  }

  /**
   * Add permissions this SDK version does not list yet. Each must look like
   * `area:action`; the server refuses one it does not know.
   */
  allowUnchecked(...permissions: string[]): this {
    for (const permission of permissions) {
      if (!/^[a-z][a-z0-9_.]*:[a-z][a-z0-9_]*$/.test(permission)) {
        throw new TypeError(`${permission} is not a permission`);
      }
    }
    uniquePush(this.#permissions, permissions);
    return this;
  }

  /** Set one area of the permission matrix (areas from `GET /keys/builder`). */
  matrix(area: string, level: GrantSpecMatrixLevel): this {
    if (!area.trim()) throw new TypeError("matrix area must not be empty");
    this.#matrix[area] = level;
    return this;
  }

  /** Limit mail to these addresses. */
  addresses(...addresses: string[]): this {
    uniquePush(this.#addresses, addresses);
    return this;
  }

  /** Limit mail to these domains. */
  domains(...domains: string[]): this {
    uniquePush(this.#domains, domains);
    return this;
  }

  /** Limit one resource type to these ids. */
  resources(type: ResourceType, ...ids: string[]): this {
    if (!RESOURCE_TYPES.includes(type)) {
      throw new TypeError(
        `resource type must be one of ${RESOURCE_TYPES.join(", ")}`,
      );
    }
    const list = this.#resources[type] ?? [];
    uniquePush(list, ids);
    this.#resources[type] = list;
    return this;
  }

  /**
   * The wire value. A preset with nothing added is sent as its name, which
   * is what the server stores for it.
   */
  build(): KeyGrant {
    const narrowed =
      this.#permissions.length > 0 ||
      this.#addresses.length > 0 ||
      this.#domains.length > 0 ||
      Object.keys(this.#matrix).length > 0 ||
      Object.keys(this.#resources).length > 0;
    if (this.#preset === "custom" && narrowed === false) {
      throw new TypeError(
        "a custom grant needs at least one permission or matrix area",
      );
    }
    if (!narrowed) return this.#preset;
    const spec: KeyGrantSpec = { preset: this.#preset };
    if (this.#permissions.length > 0) spec.permissions = [...this.#permissions];
    if (Object.keys(this.#matrix).length > 0) spec.matrix = { ...this.#matrix };
    if (this.#addresses.length > 0) spec.addresses = [...this.#addresses];
    if (this.#domains.length > 0) spec.domains = [...this.#domains];
    if (Object.keys(this.#resources).length > 0) {
      spec.resources = Object.fromEntries(
        Object.entries(this.#resources).map(([type, ids]) => [type, [...ids]]),
      );
    }
    return spec;
  }

  toJSON(): KeyGrant {
    return this.build();
  }
}
