// Checks and shrinks images BEFORE they are uploaded.
// Only PNG, JPEG and WebP are accepted. SVG is refused on purpose (it can contain scripts).
// Re-drawing the picture on a canvas also strips any hidden data from the file.
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const OK = ["image/png", "image/jpeg", "image/webp"];

export function checkImageFile(file) {
  if (!file) return "No file chosen.";
  if (!OK.includes(file.type)) return "Please choose a PNG, JPEG or WebP picture. (SVG files are not allowed.)";
  if (file.size > MAX_IMAGE_BYTES) return "That picture is bigger than 8 MB. Please choose a smaller one.";
  return null;
}

function loadBitmap(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file could not be read as a picture.")); };
    img.src = url;
  });
}

const toBlob = (canvas, type, q) => new Promise((r) => canvas.toBlob(r, type, q));

// Returns { blob, width, height } with the longest side at most `max` pixels.
export async function prepareImage(file, max = 1600) {
  const bad = checkImageFile(file);
  if (bad) throw new Error(bad);
  const img = await loadBitmap(file);
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * k));
  const height = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = width; c.height = height;
  c.getContext("2d").drawImage(img, 0, 0, width, height);
  const keepPng = file.type === "image/png";
  const blob = await toBlob(c, keepPng ? "image/png" : "image/jpeg", 0.88);
  return { blob, width, height, canvas: c };
}

// DEV TEST MODE only: a tiny JPEG as a data: link, small enough to travel inside an edit.
export async function tinyDataUrl(file, maxChars = 45000) {
  const { canvas } = await prepareImage(file, 1600);
  let side = 520;
  for (let i = 0; i < 8; i++) {
    const k = Math.min(1, side / Math.max(canvas.width, canvas.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(canvas.width * k)); c.height = Math.max(1, Math.round(canvas.height * k));
    c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
    for (const q of [0.7, 0.5, 0.35]) {
      const url = c.toDataURL("image/jpeg", q);
      if (url.length <= maxChars) return url;
    }
    side = Math.round(side * 0.7);
  }
  throw new Error("Could not shrink that picture enough for test mode.");
}
