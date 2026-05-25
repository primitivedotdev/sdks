import { describe, expect, it } from "vitest";
import DomainsZoneFileCommand, {
  contentDispositionFilename,
  zoneFileUrl,
} from "../../src/oclif/commands/domains-zone-file.js";
import { COMMANDS } from "../../src/oclif/index.js";

describe("domains zone-file command", () => {
  it("registers the shortcut and generated-operation command ids", () => {
    expect(COMMANDS["domains:zone-file"]).toBe(DomainsZoneFileCommand);
    expect(COMMANDS["domains:download-domain-zone-file"]).toBe(
      DomainsZoneFileCommand,
    );
  });

  it("builds the API-owned zone-file download URL", () => {
    expect(
      zoneFileUrl(
        "https://api.example.test/v1/",
        "33333333-3333-4333-8333-333333333333",
        false,
      ),
    ).toBe(
      "https://api.example.test/v1/domains/33333333-3333-4333-8333-333333333333/zone-file",
    );

    expect(
      zoneFileUrl(
        "https://api.example.test/v1",
        "33333333-3333-4333-8333-333333333333",
        true,
      ),
    ).toBe(
      "https://api.example.test/v1/domains/33333333-3333-4333-8333-333333333333/zone-file?outbound_only=true",
    );
  });

  it("parses Content-Disposition filenames", () => {
    expect(
      contentDispositionFilename('attachment; filename="example.com.zone"'),
    ).toBe("example.com.zone");
    expect(
      contentDispositionFilename(
        "attachment; filename*=UTF-8''mail.example.com.zone",
      ),
    ).toBe("mail.example.com.zone");
    expect(contentDispositionFilename(null)).toBeNull();
  });
});
