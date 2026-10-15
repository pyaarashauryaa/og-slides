// Tests the file writers used by export (ZIP and PDF). SIMULATED: no browser, no real slides.
// The real "click Export and open the file" check is done in a browser (see the README checklist).
import test from "node:test";
import assert from "node:assert/strict";
import { makeZip, crc32 } from "../src/export/zip.js";
import { makePdf } from "../src/export/pdf.js";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("crc32 matches the known value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("zip has the right signatures, entry count and names", () => {
  const z = makeZip([{ name: "a.png", data: new Uint8Array([1, 2, 3]) }, { name: "b.png", data: new Uint8Array([4, 5]) }]);
  const dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(dv.getUint32(z.length - 22, true), 0x06054b50);
  assert.equal(dv.getUint16(z.length - 22 + 10, true), 2);
  const dir = mkdtempSync(join(tmpdir(), "ogs-zip-"));
  const f = join(dir, "t.zip");
  writeFileSync(f, z);
  try {
    const out = execFileSync("python3", ["-c", "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(sorted(z.namelist()));print(list(z.read('a.png')))", f]).toString();
    assert.match(out, /^None/);
    assert.match(out, /\['a.png', 'b.png'\]/);
    assert.match(out, /\[1, 2, 3\]/);
  } catch (e) { if (e.code === "ENOENT") return; throw e; }
});
test("pdf has one page per slide and a valid xref", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = makePdf([{ jpeg, width: 4, height: 2 }, { jpeg, width: 4, height: 2 }, { jpeg, width: 4, height: 2 }], { title: "T (x)" });
  const text = Buffer.from(pdf).toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.equal((text.match(/\/Type \/Page /g) || []).length, 3);
  assert.match(text, /\/Count 3/);
  const xrefAt = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(xrefAt, xrefAt + 4), "xref");
  // every offset must point at "N 0 obj"
  const entries = [...text.slice(xrefAt).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
  entries.forEach((off, i) => assert.ok(text.slice(off).startsWith(`${i + 1} 0 obj`), `object ${i + 1} offset`));
});
