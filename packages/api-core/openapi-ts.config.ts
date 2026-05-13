// Run from packages/api-core. Input is the shared OpenAPI codegen
// JSON at the repo root (also consumed by sdk-python and sdk-go);
// output goes directly into packages/api-core/src/api/.
export default {
  client: "fetch",
  input: "../../openapi/primitive-api.codegen.json",
  output: "src/api",
};
