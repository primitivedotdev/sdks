// DOM-free subset of `./parser`: the RFC 5322 From-header parsers only.
//
// The `./parser` barrel also re-exports `sanitizeHtml`, which pulls in
// `isomorphic-dompurify`. That module runs `purify.sanitize.bind(purify)`
// at import time and crashes on DOM-less runtimes (e.g. Cloudflare
// Workers), where `createDOMPurify()` returns a stub without `.sanitize`.
//
// Consumers that only need address parsing (e.g. core-api / send-mail
// Workers) should import from `@primitivedotdev/sdk/parser/address` to
// avoid dragging dompurify into their bundle.
export type {
  ParsedAddress,
  ParseFromHeaderFailureReason,
  ParseFromHeaderResult,
  ValidatedAddress,
} from "./address-parser.js";
export {
  parseFromHeader,
  parseFromHeaderLoose,
} from "./address-parser.js";
