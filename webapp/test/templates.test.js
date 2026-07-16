import { test } from "node:test";
import assert from "node:assert/strict";

import { TEMPLATES, applyTemplate, findTemplate } from "../js/templates.js";
import { BUTTONS_PER_LAYER, MEDIA_KEYS, MODIFIERS } from "../js/model.js";
import { GLYPH_NAMES } from "../js/glyphs.js";

function isValidAction(action) {
  if (!action || typeof action !== "object") return false;
  if (action.type === "key") {
    return (
      Number.isInteger(action.usage) &&
      Array.isArray(action.modifiers) &&
      action.modifiers.every((m) => MODIFIERS.includes(m))
    );
  }
  if (action.type === "media") {
    return MEDIA_KEYS.includes(action.key);
  }
  if (action.type === "layer") {
    return typeof action.target === "string" && action.target.length > 0;
  }
  return false;
}

test("every template has exactly 6 slots (or null) with a valid action shape", () => {
  for (const template of TEMPLATES) {
    assert.equal(template.buttons.length, BUTTONS_PER_LAYER, `${template.id} has ${BUTTONS_PER_LAYER} slots`);
    for (const slot of template.buttons) {
      if (slot === null) continue;
      assert.ok(typeof slot.label === "string" && slot.label.length > 0, `${template.id} slot has a label`);
      assert.ok(typeof slot.color === "string", `${template.id} slot has a color`);
      assert.ok(isValidAction(slot.action), `${template.id} slot "${slot.label}" has a valid action`);
    }
  }
});

test("all eight initial templates are present", () => {
  const ids = TEMPLATES.map((t) => t.id);
  assert.ok(ids.includes("logic-transport"));
  assert.ok(ids.includes("protools-transport"));
  assert.ok(ids.includes("ableton-transport"));
  assert.ok(ids.includes("obs-scene-control"));
  assert.ok(ids.includes("media-controls"));
  assert.ok(ids.includes("logic-tools"));
  assert.ok(ids.includes("davinci-resolve-edit"));
  assert.ok(ids.includes("app-launcher"));
});

test("OBS template flags all 6 buttons with requiresSetup", () => {
  const obs = findTemplate("obs-scene-control");
  assert.ok(obs);
  for (const slot of obs.buttons) {
    assert.ok(slot, "OBS template has no empty slots");
    assert.equal(slot.requiresSetup, true, `${slot.label} requires setup`);
    assert.ok(slot.setupNote && slot.setupNote.length > 0, `${slot.label} has a setup note`);
  }
});

test("Ableton template flags exactly Metronome and Tap Tempo with requiresSetup", () => {
  const ableton = findTemplate("ableton-transport");
  assert.ok(ableton);
  const flagged = ableton.buttons.filter((s) => s && s.requiresSetup).map((s) => s.label);
  assert.deepEqual(flagged.sort(), ["Metronome", "Tap Tempo"].sort());

  const unflagged = ableton.buttons.filter((s) => s && !s.requiresSetup).map((s) => s.label);
  assert.deepEqual(unflagged.sort(), ["Play", "Record", "Restart", "Undo"].sort());
});

test("App Launcher template flags all 6 buttons with requiresSetup", () => {
  const launcher = findTemplate("app-launcher");
  assert.ok(launcher);
  for (const slot of launcher.buttons) {
    assert.ok(slot, "App Launcher template has no empty slots");
    assert.equal(slot.requiresSetup, true, `${slot.label} requires setup`);
    assert.ok(slot.setupNote && slot.setupNote.length > 0, `${slot.label} has a setup note`);
  }
});

test("Media Controls, Logic Tools Palette, and DaVinci Resolve Edit flag nothing", () => {
  for (const id of ["media-controls", "logic-tools", "davinci-resolve-edit"]) {
    const template = findTemplate(id);
    assert.ok(template, `${id} exists`);
    for (const slot of template.buttons) {
      assert.ok(slot, `${id} has no empty slots`);
      assert.equal(slot.requiresSetup, undefined, `${id}'s ${slot.label} is not flagged`);
    }
  }
});

test("applyTemplate strips requiresSetup/setupNote, leaving only label/color/action", () => {
  const obs = findTemplate("obs-scene-control");
  const layer = applyTemplate(obs, "my-obs-layer");

  assert.equal(layer.id, "my-obs-layer");
  assert.equal(layer.buttons.length, BUTTONS_PER_LAYER);
  for (const slot of layer.buttons) {
    assert.ok(slot, "no empty slots expected for the OBS template");
    assert.deepEqual(Object.keys(slot).sort(), ["action", "color", "label"]);
    assert.equal(slot.requiresSetup, undefined);
    assert.equal(slot.setupNote, undefined);
  }
});

test("every template button has an iconGlyph that exists in the glyph library", () => {
  for (const template of TEMPLATES) {
    for (const slot of template.buttons) {
      if (slot === null) continue;
      assert.ok(
        typeof slot.iconGlyph === "string" && slot.iconGlyph.length > 0,
        `${template.id} slot "${slot.label}" has an iconGlyph`,
      );
      assert.ok(
        GLYPH_NAMES.includes(slot.iconGlyph),
        `${template.id} slot "${slot.label}"'s iconGlyph "${slot.iconGlyph}" is a real glyph`,
      );
    }
  }
});

test("applyTemplate strips iconGlyph too, leaving only label/color/action", () => {
  const logic = findTemplate("logic-transport");
  const layer = applyTemplate(logic, "my-logic-layer");
  for (const slot of layer.buttons) {
    assert.ok(slot);
    assert.equal(slot.iconGlyph, undefined);
    assert.deepEqual(Object.keys(slot).sort(), ["action", "color", "label"]);
  }
});

test("applyTemplate preserves empty slots as null", () => {
  const logic = findTemplate("logic-transport");
  const layer = applyTemplate(logic, "my-logic-layer");
  // Logic template fills all 6 slots today, but the function must still
  // handle a template with fewer than 6 configured buttons correctly.
  const partialTemplate = {
    id: "partial",
    name: "Partial",
    description: "test",
    buttons: [logic.buttons[0], null, null, null, null, null],
  };
  const partialLayer = applyTemplate(partialTemplate, "partial-layer");
  assert.equal(partialLayer.buttons[0].label, logic.buttons[0].label);
  for (let i = 1; i < BUTTONS_PER_LAYER; i++) {
    assert.equal(partialLayer.buttons[i], null);
  }
});
