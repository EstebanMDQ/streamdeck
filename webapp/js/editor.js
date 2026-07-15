// DOM rendering/editing for the layer/button editor. Implements:
//   openspec/changes/add-macropad-mvp/specs/webapp-layer-editor/spec.md
// Browser-only (DOM APIs) - the validation logic it calls into
// (validation.js) is what's unit tested.

import { BUTTONS_PER_LAYER, MEDIA_KEYS, MODIFIERS } from "./model.js";
import { canDeleteLayer, findMissingLayerTargets } from "./validation.js";

export class Editor {
  constructor(root, config, onChange) {
    this.root = root;
    this.config = config;
    this.currentLayerId = config.rootLayer;
    this.onChange = onChange || (() => {});
    this.selectedSlot = null;
  }

  setConfig(config) {
    this.config = config;
    this.currentLayerId = config.rootLayer;
    this.selectedSlot = null;
    this.render();
  }

  render() {
    this.root.innerHTML = "";
    this.root.appendChild(this._renderLayerBar());
    this.root.appendChild(this._renderGrid());
    this.root.appendChild(this._renderSlotEditor());
    this.root.appendChild(this._renderValidation());
  }

  _renderLayerBar() {
    const bar = document.createElement("div");
    bar.className = "layer-bar";

    for (const layerId of Object.keys(this.config.layers)) {
      const btn = document.createElement("button");
      btn.textContent = layerId === this.config.rootLayer
        ? `${layerId} (root)`
        : layerId;
      btn.className =
        "layer-tab" + (layerId === this.currentLayerId ? " active" : "");
      btn.addEventListener("click", () => {
        this.currentLayerId = layerId;
        this.selectedSlot = null;
        this.render();
      });
      bar.appendChild(btn);
    }

    const newLayerBtn = document.createElement("button");
    newLayerBtn.textContent = "+ New layer";
    newLayerBtn.className = "layer-tab new-layer";
    newLayerBtn.addEventListener("click", () => this._createLayer());
    bar.appendChild(newLayerBtn);

    if (this.currentLayerId !== this.config.rootLayer) {
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete this layer";
      deleteBtn.className = "layer-tab delete-layer";
      deleteBtn.addEventListener("click", () => this._deleteCurrentLayer());
      bar.appendChild(deleteBtn);
    }

    return bar;
  }

  _renderGrid() {
    const grid = document.createElement("div");
    grid.className = "button-grid";

    const layer = this.config.layers[this.currentLayerId];
    for (let i = 0; i < BUTTONS_PER_LAYER; i++) {
      const slot = layer.buttons[i];
      const cell = document.createElement("button");
      cell.className = "slot" + (slot ? "" : " empty");
      cell.style.background = slot ? slot.color : "";
      cell.textContent = slot ? slot.label : "(empty)";
      if (this.selectedSlot === i) {
        cell.classList.add("selected");
      }
      cell.addEventListener("click", () => {
        this.selectedSlot = i;
        this.render();
      });
      grid.appendChild(cell);
    }

    return grid;
  }

  _renderSlotEditor() {
    const panel = document.createElement("div");
    panel.className = "slot-editor";

    if (this.selectedSlot === null) {
      panel.textContent = "Select a button slot to edit it.";
      return panel;
    }

    const layer = this.config.layers[this.currentLayerId];
    const slot = layer.buttons[this.selectedSlot] || {
      label: "",
      color: "#264653",
      action: { type: "key", usage: 4, modifiers: [] },
    };

    const labelInput = this._input("text", slot.label, (v) => {
      slot.label = v;
      this._commitSlot(slot);
    });
    const colorInput = this._input("color", slot.color || "#264653", (v) => {
      slot.color = v;
      this._commitSlot(slot);
    });

    const typeSelect = document.createElement("select");
    for (const type of ["key", "media", "layer"]) {
      const opt = document.createElement("option");
      opt.value = type;
      opt.textContent = type;
      if (slot.action.type === type) opt.selected = true;
      typeSelect.appendChild(opt);
    }
    typeSelect.addEventListener("change", () => {
      const type = typeSelect.value;
      slot.action =
        type === "key"
          ? { type: "key", usage: 4, modifiers: [] }
          : type === "media"
            ? { type: "media", key: MEDIA_KEYS[0] }
            : { type: "layer", target: this._firstOtherLayerId() };
      this._commitSlot(slot);
      this.render();
    });

    panel.appendChild(this._field("Label", labelInput));
    panel.appendChild(this._field("Color", colorInput));
    panel.appendChild(this._field("Action type", typeSelect));
    panel.appendChild(this._renderActionFields(slot));

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear slot";
    clearBtn.addEventListener("click", () => {
      layer.buttons[this.selectedSlot] = null;
      this.onChange(this.config);
      this.render();
    });
    panel.appendChild(clearBtn);

    return panel;
  }

  _renderActionFields(slot) {
    const wrap = document.createElement("div");

    if (slot.action.type === "key") {
      const usageInput = this._input("number", slot.action.usage, (v) => {
        slot.action.usage = parseInt(v, 10) || 0;
        this._commitSlot(slot);
      });
      wrap.appendChild(this._field("HID usage code", usageInput));

      const modsWrap = document.createElement("div");
      for (const mod of MODIFIERS) {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = slot.action.modifiers.includes(mod);
        checkbox.addEventListener("change", () => {
          slot.action.modifiers = checkbox.checked
            ? [...slot.action.modifiers, mod]
            : slot.action.modifiers.filter((m) => m !== mod);
          this._commitSlot(slot);
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(mod));
        modsWrap.appendChild(label);
      }
      wrap.appendChild(this._field("Modifiers", modsWrap));
    } else if (slot.action.type === "media") {
      const select = document.createElement("select");
      for (const key of MEDIA_KEYS) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = key;
        if (slot.action.key === key) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener("change", () => {
        slot.action.key = select.value;
        this._commitSlot(slot);
      });
      wrap.appendChild(this._field("Media key", select));
    } else if (slot.action.type === "layer") {
      const select = document.createElement("select");
      for (const layerId of Object.keys(this.config.layers)) {
        const opt = document.createElement("option");
        opt.value = layerId;
        opt.textContent = layerId;
        if (slot.action.target === layerId) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener("change", () => {
        slot.action.target = select.value;
        this._commitSlot(slot);
      });
      wrap.appendChild(this._field("Target layer", select));
    }

    return wrap;
  }

  _renderValidation() {
    const box = document.createElement("div");
    box.className = "validation-box";
    const errors = findMissingLayerTargets(this.config);
    if (errors.length === 0) {
      box.textContent = "Configuration is valid.";
      box.classList.add("ok");
    } else {
      box.classList.add("error");
      box.textContent = errors
        .map(
          (e) =>
            `Layer "${e.layerId}" slot ${e.index + 1} points at missing layer "${e.target}"`,
        )
        .join("; ");
    }
    return box;
  }

  _commitSlot(slot) {
    const layer = this.config.layers[this.currentLayerId];
    layer.buttons[this.selectedSlot] = slot;
    this.onChange(this.config);
  }

  _createLayer() {
    const id = window.prompt("New layer id (letters, numbers, hyphens):");
    if (!id) return;
    if (this.config.layers[id]) {
      window.alert(`Layer "${id}" already exists.`);
      return;
    }
    this.config.layers[id] = { buttons: new Array(BUTTONS_PER_LAYER).fill(null) };
    this.currentLayerId = id;
    this.onChange(this.config);
    this.render();
  }

  _deleteCurrentLayer() {
    const result = canDeleteLayer(this.config, this.currentLayerId);
    if (!result.ok) {
      const refs = result.referencedBy
        .map((r) => `"${r.layerId}" slot ${r.index + 1}`)
        .join(", ");
      window.alert(
        result.reason === "root_layer"
          ? "The root layer can't be deleted."
          : `Can't delete: still referenced by ${refs}.`,
      );
      return;
    }
    delete this.config.layers[this.currentLayerId];
    this.currentLayerId = this.config.rootLayer;
    this.selectedSlot = null;
    this.onChange(this.config);
    this.render();
  }

  _firstOtherLayerId() {
    return (
      Object.keys(this.config.layers).find(
        (id) => id !== this.currentLayerId,
      ) || this.currentLayerId
    );
  }

  _input(type, value, onInput) {
    const input = document.createElement("input");
    input.type = type;
    input.value = value;
    input.addEventListener("input", () => onInput(input.value));
    return input;
  }

  _field(labelText, control) {
    const wrap = document.createElement("label");
    wrap.className = "field";
    const span = document.createElement("span");
    span.textContent = labelText;
    wrap.appendChild(span);
    wrap.appendChild(control);
    return wrap;
  }
}
