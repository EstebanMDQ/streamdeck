import { test } from "node:test";
import assert from "node:assert/strict";

import { contrastColor, GLYPH_NAMES } from "../js/glyphs.js";

test("contrastColor picks a light foreground for dark backgrounds", () => {
  assert.equal(contrastColor("#264653"), "#ffffff"); // dark navy
  assert.equal(contrastColor("#000000"), "#ffffff");
  assert.equal(contrastColor("#457b9d"), "#ffffff"); // medium blue
});

test("contrastColor picks a dark foreground for light backgrounds", () => {
  assert.equal(contrastColor("#e9c46a"), "#111111"); // light gold
  assert.equal(contrastColor("#ffffff"), "#111111");
});

test("GLYPH_NAMES has no duplicate entries", () => {
  assert.equal(new Set(GLYPH_NAMES).size, GLYPH_NAMES.length);
});
