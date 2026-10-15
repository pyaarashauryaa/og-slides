// A minimal PDF writer: one JPEG picture per page, page size 960 x 540 points (16:9).
// Slides are pictures, so text in the PDF cannot be selected or searched. That is a known limitation.
export function makePdf(pages, { title = "Presentation", pageW = 960, pageH = 540 } = {}) {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let len = 0;
  const add = (x) => { const u = typeof x === "string" ? enc.encode(x) : x; parts.push(u); len += u.length; };
  const obj = (n, body) => { offsets[n] = len; add(`${n} 0 obj\n`); add(body); add("\nendobj\n"); };
  const esc = (s) => s.replace(/[\\()]/g, (m) => `\\${m}`).replace(/[^\x20-\x7e]/g, "?");
  add("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  const n = pages.length;
  // object numbers: 1 catalog, 2 pages, 3 info, then 3 per page (page, content, image)
  const pageNo = (k) => 4 + k * 3;
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, k) => `${pageNo(k)} 0 R`).join(" ")}] /Count ${n} >>`);
  obj(3, `<< /Title (${esc(title)}) /Producer (OGSlides) >>`);
  pages.forEach((p, k) => {
    const pg = pageNo(k), ct = pg + 1, im = pg + 2;
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
    obj(ct, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    offsets[im] = len;
    add(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    add(p.jpeg);
    add("\nendstream\nendobj\n");
  });
  const total = pageNo(n - 1) + 3 || 4;
  const xref = len;
  add(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) add(`${String(offsets[i] || 0).padStart(10, "0")} 00000 n \n`);
  add(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let p = 0;
  for (const u of parts) { out.set(u, p); p += u.length; }
  return out;
}
