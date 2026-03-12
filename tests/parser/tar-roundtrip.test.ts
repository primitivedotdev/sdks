import { describe, test, expect } from 'vitest';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { gunzipSync } from 'node:zlib';
import { sanitizeFilename } from '../../src/parser/attachment-parser.js';

// Simple tar parser (same as forward-analysis.ts)
function parseTar(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let offset = 0;

  while (offset < buffer.length - 512) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;

    const nameEnd = header.indexOf(0);
    const name = header
      .subarray(0, nameEnd > 0 && nameEnd < 100 ? nameEnd : 100)
      .toString('utf-8')
      .trim();

    const sizeStr = header.subarray(124, 136).toString('utf-8').trim();
    const size = parseInt(sizeStr, 8) || 0;

    offset += 512;

    if (size > 0 && name) {
      files.set(name, buffer.subarray(offset, offset + size));
    }

    offset += Math.ceil(size / 512) * 512;
  }

  return files;
}

async function verifyRoundTrip(
  originalFilename: string,
  partIndex: number
): Promise<{ tarPath: string; found: boolean; content: boolean }> {
  const content = Buffer.from(`Content of ${originalFilename}`);

  // This is what our code does:
  const sanitized = sanitizeFilename(originalFilename, partIndex);
  const tarPath = `${partIndex}_${sanitized}`;

  // Create tar with the tarPath
  const archive = archiver('tar', { gzip: true });
  const chunks: Buffer[] = [];
  const passThrough = new PassThrough();

  passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
  archive.pipe(passThrough);

  archive.append(content, { name: tarPath });
  await archive.finalize();

  await new Promise<void>((resolve) => passThrough.on('end', resolve));

  // Parse it back
  const tarGz = Buffer.concat(chunks);
  const tar = gunzipSync(tarGz);
  const files = parseTar(tar);

  // Can we find it by the exact tarPath?
  const foundContent = files.get(tarPath);

  return {
    tarPath,
    found: foundContent !== undefined,
    content: foundContent?.toString() === content.toString(),
  };
}

describe('tar archive round-trip with sanitized filenames', () => {
  const testCases = [
    // Problem cases we fixed
    ['colon in filename', 'Climate: The Report.eml'],
    ['CJK characters', '\u5831\u544A\u66F8.pdf'],
    ['emoji', 'Report \uD83D\uDCE7.eml'],
    ['unicode + colon', 'Caf\u00E9: Menu.pdf'],
    ['multiple colons', 'Time: 10:30 AM.eml'],

    // Normal cases
    ['simple filename', 'normal-file.eml'],
    ['spaces', 'file with spaces.pdf'],
    ['uppercase', 'UPPERCASE.EML'],

    // Edge cases
    ['multiple dots', 'file.name.with.dots.eml'],
    ['dashes', 'file-with-dashes.eml'],
    ['underscores', 'file_with_underscores.eml'],
    ['numeric start', '123-numeric-start.eml'],
    ['special chars', 'file@#$%^&()+=.eml'],
  ] as const;

  test.each(testCases)('%s: %s', async (_, filename) => {
    const result = await verifyRoundTrip(filename, 0);
    expect(result.found).toBe(true);
    expect(result.content).toBe(true);
  });

  test('multiple files with same original name get unique tarPaths', async () => {
    const filename = 'duplicate.eml';

    const result0 = await verifyRoundTrip(filename, 0);
    const result1 = await verifyRoundTrip(filename, 1);
    const result2 = await verifyRoundTrip(filename, 2);

    // All should be found
    expect(result0.found).toBe(true);
    expect(result1.found).toBe(true);
    expect(result2.found).toBe(true);

    // All should have different tarPaths
    expect(result0.tarPath).toBe('0_duplicate.eml');
    expect(result1.tarPath).toBe('1_duplicate.eml');
    expect(result2.tarPath).toBe('2_duplicate.eml');
  });

  test('problematic filenames get sanitized tarPaths', async () => {
    const result1 = await verifyRoundTrip('Climate: Report.eml', 0);
    expect(result1.tarPath).toBe('0_Climate- Report.eml');
    expect(result1.found).toBe(true);

    const result2 = await verifyRoundTrip('\u5831\u544A\u66F8.pdf', 1);
    expect(result2.tarPath).toBe('1____.pdf');
    expect(result2.found).toBe(true);

    const result3 = await verifyRoundTrip('Report \uD83D\uDCE7.eml', 2);
    expect(result3.tarPath).toBe('2_Report __.eml');
    expect(result3.found).toBe(true);
  });
});
