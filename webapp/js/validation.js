// Pure layer-tree validation logic - no DOM/BLE dependency, so it's directly
// unit-testable with Node's built-in test runner (see webapp/test/). Mirrors
// the requirements in:
//   openspec/changes/add-macropad-mvp/specs/webapp-layer-editor/spec.md

// Returns one entry per button whose action is a `layer` type pointing at a
// target that doesn't exist in `config.layers`.
export function findMissingLayerTargets(config) {
  const errors = [];
  for (const [layerId, layer] of Object.entries(config.layers)) {
    layer.buttons.forEach((slot, index) => {
      if (slot && slot.action && slot.action.type === "layer") {
        const target = slot.action.target;
        if (!config.layers[target]) {
          errors.push({ layerId, index, target });
        }
      }
    });
  }
  return errors;
}

// webapp-layer-editor: "Editor blocks pushing an invalid configuration".
export function isPushValid(config) {
  return findMissingLayerTargets(config).length === 0;
}

// Every button (across every layer) whose `layer` action targets `layerId`.
export function findLayerReferences(config, layerId) {
  const refs = [];
  for (const [fromLayerId, layer] of Object.entries(config.layers)) {
    layer.buttons.forEach((slot, index) => {
      if (
        slot &&
        slot.action &&
        slot.action.type === "layer" &&
        slot.action.target === layerId
      ) {
        refs.push({ layerId: fromLayerId, index });
      }
    });
  }
  return refs;
}

// webapp-layer-editor: "Editor supports deleting a layer" - blocks deleting
// the root layer or a layer still referenced by any button.
export function canDeleteLayer(config, layerId) {
  if (layerId === config.rootLayer) {
    return { ok: false, reason: "root_layer", referencedBy: [] };
  }
  const referencedBy = findLayerReferences(config, layerId);
  if (referencedBy.length > 0) {
    return { ok: false, reason: "referenced", referencedBy };
  }
  return { ok: true, referencedBy: [] };
}
