import { test } from "node:test";
import assert from "node:assert/strict";

import {
  rgbaToRgb565,
  computeIconId,
  ICON_WIDTH,
  ICON_HEIGHT,
  ICON_BYTES,
} from "../js/icon.js";

test("ICON_BYTES matches 64x64 RGB565 (8192 bytes) - the firmware's expected size", () => {
  assert.equal(ICON_WIDTH, 64);
  assert.equal(ICON_HEIGHT, 64);
  assert.equal(ICON_BYTES, 64 * 64 * 2);
  assert.equal(ICON_BYTES, 8192);
});

test("rgbaToRgb565 produces exactly width*height*2 bytes", () => {
  const rgba = new Uint8ClampedArray(4 * 4 * 4); // 4x4 image
  const out = rgbaToRgb565(rgba, 4, 4);
  assert.equal(out.length, 4 * 4 * 2);
});

test("rgbaToRgb565 packs solid red correctly (big-endian per pixel)", () => {
  // Pure red: R=255,G=0,B=0,A=255 -> 5-bit R=31, 6-bit G=0, 5-bit B=0
  // -> value = 0b11111_000000_00000 = 0xF800
  const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
  const out = rgbaToRgb565(rgba, 1, 1);
  assert.equal(out.length, 2);
  assert.equal(out[0], 0xf8); // high byte first
  assert.equal(out[1], 0x00);
});

test("rgbaToRgb565 packs solid green correctly", () => {
  // Pure green: R=0,G=255,B=0 -> 6-bit G=63 -> value = 0b00000_111111_00000 = 0x07E0
  const rgba = new Uint8ClampedArray([0, 255, 0, 255]);
  const out = rgbaToRgb565(rgba, 1, 1);
  assert.equal(out[0], 0x07);
  assert.equal(out[1], 0xe0);
});

test("rgbaToRgb565 packs solid blue correctly", () => {
  // Pure blue: R=0,G=0,B=255 -> 5-bit B=31 -> value = 0b00000_000000_11111 = 0x001F
  const rgba = new Uint8ClampedArray([0, 0, 255, 255]);
  const out = rgbaToRgb565(rgba, 1, 1);
  assert.equal(out[0], 0x00);
  assert.equal(out[1], 0x1f);
});

test("rgbaToRgb565 packs black as all zero bytes", () => {
  const rgba = new Uint8ClampedArray([0, 0, 0, 255]);
  const out = rgbaToRgb565(rgba, 1, 1);
  assert.equal(out[0], 0x00);
  assert.equal(out[1], 0x00);
});

test("computeIconId is deterministic for identical bytes", async () => {
  const bytesA = new Uint8Array([1, 2, 3, 4, 5]);
  const bytesB = new Uint8Array([1, 2, 3, 4, 5]);
  const idA = await computeIconId(bytesA);
  const idB = await computeIconId(bytesB);
  assert.equal(idA, idB);
});

test("computeIconId differs for different bytes", async () => {
  const idA = await computeIconId(new Uint8Array([1, 2, 3]));
  const idB = await computeIconId(new Uint8Array([4, 5, 6]));
  assert.notEqual(idA, idB);
});

test("computeIconId returns a 16-character hex string", async () => {
  const id = await computeIconId(new Uint8Array([9, 9, 9]));
  assert.equal(id.length, 16);
  assert.match(id, /^[0-9a-f]{16}$/);
});
