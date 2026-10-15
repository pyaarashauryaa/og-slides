import { renderSlide } from "./render.js";
import { makePdf } from "./pdf.js";
import { makeZip } from "./zip.js";

const safeName = (s) => (s || "presentation").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "presentation";
const toBlob = (canvas, type, q) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("The browser could not create the image."))), type, q));
const bytes = async (blob) => new Uint8Array(await blob.arrayBuffer());

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function exportPng(deck, slide, number = 1) {
  const { canvas, skippedImages } = await renderSlide(slide, deck.theme, { width: 1920 });
  const filename = `${safeName(deck.title)}-slide-${number}.png`;
  download(await toBlob(canvas, "image/png"), filename);
  return { filename, skippedImages };
}

export async function exportZip(deck, slides) {
  const files = [];
  let skippedImages = 0;
  for (let i = 0; i < slides.length; i++) {
    const r = await renderSlide(slides[i], deck.theme, { width: 1920 });
    skippedImages += r.skippedImages;
    files.push({ name: `slide-${String(i + 1).padStart(2, "0")}.png`, data: await bytes(await toBlob(r.canvas, "image/png")) });
  }
  const filename = `${safeName(deck.title)}-slides.zip`;
  download(new Blob([makeZip(files)], { type: "application/zip" }), filename);
  return { filename, skippedImages };
}

export async function exportPdf(deck, slides) {
  const pages = [];
  let skippedImages = 0;
  for (const s of slides) {
    const r = await renderSlide(s, deck.theme, { width: 1920 });
    skippedImages += r.skippedImages;
    pages.push({ jpeg: await bytes(await toBlob(r.canvas, "image/jpeg", 0.92)), width: r.canvas.width, height: r.canvas.height });
  }
  const filename = `${safeName(deck.title)}.pdf`;
  download(new Blob([makePdf(pages, { title: deck.title || "Presentation" })], { type: "application/pdf" }), filename);
  return { filename, skippedImages };
}
