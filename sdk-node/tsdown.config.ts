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
  dts: {
    sourcemap: false,
  },
  clean: true,
  sourcemap: false,
});
