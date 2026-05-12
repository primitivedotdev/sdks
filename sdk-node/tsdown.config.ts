import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/webhook/index.ts",
    "src/api/index.ts",
    "src/openapi/index.ts",
    "src/contract/index.ts",
    "src/parser/index.ts",
  ],
  format: ["esm"],
  // Keep `.js` / `.d.ts` extensions so the existing `package.json` exports map
  // (which references `./dist/.../index.js`) keeps resolving. tsdown defaults
  // to `.mjs` on the node platform; we override that here.
  fixedExtension: false,
  // Inline the workspace-internal api-core package into the published
  // tarball. api-core is marked `"private": true` and never appears on
  // the registry; without an explicit alwaysBundle entry the output
  // would emit an `import "@primitivedotdev/api-core"` that resolves
  // to nothing at install time. Listing the dep here walks its source
  // through the same dist pipeline as sdk-node's own code, so the
  // published `@primitivedotdev/sdk` carries the generated client,
  // manifest, openapi document, and PrimitiveApiClient inline.
  deps: {
    alwaysBundle: ["@primitivedotdev/api-core"],
  },
  dts: {
    // tsc-based dts pipeline. The default rolldown-based dts bundler
    // chokes on the api-core re-export shape (`Export 'PrimitiveApiError'
    // is not defined`); `eager: true` switches to tsc which handles the
    // re-export passthrough correctly.
    eager: true,
    sourcemap: false,
  },
  clean: true,
  sourcemap: false,
});
