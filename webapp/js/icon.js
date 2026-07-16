// Client-side image -> device-native icon bitmap conversion. Implements:
//   openspec/changes/add-image-buttons/specs/webapp-layer-editor/spec.md
// Icons are always exactly 64x64 RGB565 (8192 bytes) - see
// lib/macropad_icon/include/macropad_icon/IconValidation.h for the
// firmware-side twin of these constants.

export const ICON_WIDTH = 64;
export const ICON_HEIGHT = 64;
export const ICON_BYTES = ICON_WIDTH * ICON_HEIGHT * 2;

// Pure function: RGBA pixel data (Uint8ClampedArray/Uint8Array, width*height*4
// bytes) -> RGB565 bytes (Uint8Array, width*height*2 bytes), big-endian per
// pixel (high byte first). Paired with a deliberate choice on the firmware
// side (DisplayManager::begin() calls tft.setSwapBytes(true)) - this
// pairing is a documented guess pending the hardware verification in
// tasks.md 2.2/5.5, not a confirmed fact. If hardware testing finds colors
// swapped, flipping setSwapBytes() on the firmware side is the fix, not
// re-packing here.
export function rgbaToRgb565(rgba, width, height) {
  const out = new Uint8Array(width * height * 2);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const r5 = r >> 3;
    const g6 = g >> 2;
    const b5 = b >> 3;
    const value = (r5 << 11) | (g6 << 5) | b5;
    out[i * 2] = (value >> 8) & 0xff; // high byte first
    out[i * 2 + 1] = value & 0xff;
  }
  return out;
}

// Content-hash id for a bitmap's bytes, so identical images across buttons
// share one stored/transferred icon. Uses Web Crypto (available in both
// browsers and modern Node, so this is unit-testable without a browser).
export async function computeIconId(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 16); // short but plenty of entropy at this scale
}

// Inverse of rgbaToRgb565 - used to build local previews of icons pulled
// back from the device (which only has RGB565 bytes, not the original
// image). Same big-endian-per-pixel byte order as the pack direction.
export function rgb565ToRgba(bytes, width, height) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const value = (bytes[i * 2] << 8) | bytes[i * 2 + 1];
    const r5 = (value >> 11) & 0x1f;
    const g6 = (value >> 5) & 0x3f;
    const b5 = value & 0x1f;
    out[i * 4] = Math.round((r5 * 255) / 31);
    out[i * 4 + 1] = Math.round((g6 * 255) / 63);
    out[i * 4 + 2] = Math.round((b5 * 255) / 31);
    out[i * 4 + 3] = 255;
  }
  return out;
}

// Browser-only: renders RGB565 bytes onto an offscreen canvas for use as a
// preview image (e.g. an icon pulled back from the device via IconDownload).
export function rgb565ToCanvas(bytes, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(rgb565ToRgba(bytes, width, height));
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Browser-only: loads an image file, cover-crops/resizes it to 64x64 via
// the Canvas API, and returns its RGB565 bytes. Not unit tested directly
// (needs a real Canvas/Image) - rgbaToRgb565 above is what's tested.
export async function convertImageToIcon(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = ICON_WIDTH;
  canvas.height = ICON_HEIGHT;
  const ctx = canvas.getContext("2d");

  // Cover-crop: scale to fill the square, cropping whichever dimension is
  // longer, so the icon fills the full 64x64 area without distortion.
  const scale = Math.max(
    ICON_WIDTH / bitmap.width,
    ICON_HEIGHT / bitmap.height,
  );
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  const dx = (ICON_WIDTH - drawWidth) / 2;
  const dy = (ICON_HEIGHT - drawHeight) / 2;
  ctx.drawImage(bitmap, dx, dy, drawWidth, drawHeight);

  const imageData = ctx.getImageData(0, 0, ICON_WIDTH, ICON_HEIGHT);
  const rgb565 = rgbaToRgb565(imageData.data, ICON_WIDTH, ICON_HEIGHT);
  const id = await computeIconId(rgb565);
  return { id, bytes: rgb565, previewCanvas: canvas };
}
