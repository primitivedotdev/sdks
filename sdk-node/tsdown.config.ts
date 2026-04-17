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
  dts: {
    sourcemap: false,
  },
  clean: true,
  sourcemap: false,
});
