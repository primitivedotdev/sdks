import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.generated.ts",
        "src/generated/**",
      ],
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
    globals: false,
    environment: "node",
  },
});
