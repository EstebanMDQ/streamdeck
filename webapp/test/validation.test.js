import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findMissingLayerTargets,
  isPushValid,
  findLayerReferences,
  canDeleteLayer,
} from "../js/validation.js";

function sampleConfig() {
  return {
    schemaVersion: 1,
    rootLayer: "root",
    layers: {
      root: {
        buttons: [
          {
            label: "Edit",
            color: "#e76f51",
            action: { type: "layer", target: "edit-layer" },
          },
          null,
          null,
          null,
          null,
          null,
        ],
      },
      "edit-layer": {
        buttons: [null, null, null, null, null, null],
      },
    },
  };
}

test("isPushValid: valid config with all targets present", () => {
  assert.equal(isPushValid(sampleConfig()), true);
});

test("findMissingLayerTargets: flags a layer action with a missing target", () => {
  const config = sampleConfig();
  config.layers.root.buttons[1] = {
    label: "Ghost",
    color: "#000000",
    action: { type: "layer", target: "does-not-exist" },
  };

  const errors = findMissingLayerTargets(config);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].layerId, "root");
  assert.equal(errors[0].index, 1);
  assert.equal(errors[0].target, "does-not-exist");
  assert.equal(isPushValid(config), false);
});

test("findLayerReferences: finds every button targeting a layer, across layers", () => {
  const config = sampleConfig();
  config.layers["edit-layer"].buttons[0] = {
    label: "Back to edit",
    color: "#111111",
    action: { type: "layer", target: "edit-layer" },
  };

  const refs = findLayerReferences(config, "edit-layer");
  assert.equal(refs.length, 2);
  assert.deepEqual(
    refs.map((r) => r.layerId).sort(),
    ["edit-layer", "root"],
  );
});

test("canDeleteLayer: blocks deleting the root layer", () => {
  const config = sampleConfig();
  const result = canDeleteLayer(config, "root");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "root_layer");
});

test("canDeleteLayer: blocks deleting a layer still referenced by a button", () => {
  const config = sampleConfig();
  const result = canDeleteLayer(config, "edit-layer");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "referenced");
  assert.equal(result.referencedBy.length, 1);
  assert.equal(result.referencedBy[0].layerId, "root");
  assert.equal(result.referencedBy[0].index, 0);
});

test("canDeleteLayer: allows deleting an unreferenced non-root layer", () => {
  const config = sampleConfig();
  config.layers["orphan"] = { buttons: new Array(6).fill(null) };
  const result = canDeleteLayer(config, "orphan");
  assert.equal(result.ok, true);
});
