import { defineConfig } from "tsdown";

// Bundle the CLI through tsdown so api-core's source is inlined
// into the published @primitivedotdev/cli tarball. The historical
// `tsc -p tsconfig.oclif.json` build emitted per-file output, which
// would leave a bare `import "@primitivedotdev/api-core"` in
// dist/oclif/index.js that resolves to nothing for a customer who
// only installed @primitivedotdev/cli (api-core is private and
// never published).
//
// Two entry points are listed under the historical `oclif/` output
// prefix so:
//   - bin/run.js's hard-coded `../dist/oclif/proxy-auto-detect.js`
//     import keeps resolving;
//   - oclif's command-discovery target (`dist/oclif/index.js`,
//     exporting the `COMMANDS` identifier) is emitted as a stable
//     filename rather than a hashed chunk.
//
// Using a record form for `entry` keeps the dist/oclif/ subdirectory;
// the array form flattens to dist/index.js.
export default defineConfig({
  entry: {
    "oclif/index": "src/oclif/index.ts",
    "oclif/proxy-auto-detect": "src/oclif/proxy-auto-detect.ts",
    "oclif/root-signup-hint": "src/oclif/root-signup-hint.ts",
  },
  format: ["esm"],
  // Keep `.js` so the bin and oclif config keep resolving the
  // documented paths. tsdown defaults to `.mjs` on the node
  // platform; we override.
  fixedExtension: false,
  // dts is unnecessary for the CLI: nothing imports it as a
  // library, only the bin and oclif's command runner load these
  // files at runtime.
  dts: false,
  deps: {
    // Inline api-core's source so the published tarball needs no
    // runtime resolution of the private workspace package. Without
    // this, every CLI command would fail at startup with a missing-
    // module error on the api-core specifier.
    alwaysBundle: ["@primitivedotdev/api-core"],
  },
  clean: true,
  sourcemap: false,
});
