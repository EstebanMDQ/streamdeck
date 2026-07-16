// DOM rendering/editing for the layer/button editor. Implements:
//   openspec/changes/add-macropad-mvp/specs/webapp-layer-editor/spec.md
// Browser-only (DOM APIs) - the validation logic it calls into
// (validation.js) is what's unit tested.

import { BUTTONS_PER_LAYER, MEDIA_KEYS, MODIFIERS } from "./model.js";
import { canDeleteLayer, findMissingLayerTargets } from "./validation.js";
import { TEMPLATES, findTemplate, applyTemplate } from "./templates.js";
import { convertImageToIcon } from "./icon.js";
import { generateGlyphIcon } from "./glyphs.js";

export class Editor {
  constructor(root, config, onChange) {
    this.root = root;
    this.config = config;
    this.currentLayerId = config.rootLayer;
    this.onChange = onChange || (() => {});
    this.selectedSlot = null;
    // Template picker flow: null (closed), {step: "list"}, or
    // {step: "preview", templateId}. Implements
    // openspec/changes/add-layer-templates/specs/webapp-layer-editor/spec.md
    this.templatePicker = null;
    // Icon id -> { bytes: Uint8Array, previewCanvas: HTMLCanvasElement } for
    // every icon this session knows the bitmap of, whether just converted
    // from an upload or pulled back from the device (see app.js's BLE icon
    // sync). A slot referencing an icon id absent from this map has no
    // preview yet - the grid cell falls back to its color. Implements
    // openspec/changes/add-image-buttons/specs/webapp-layer-editor/spec.md
    this.icons = new Map();
  }

  setConfig(config) {
    this.config = config;
    this.currentLayerId = config.rootLayer;
    this.selectedSlot = null;
    this.templatePicker = null;
    this.render();
  }

  render() {
    this.root.innerHTML = "";
    this.root.appendChild(this._renderLayerBar());
    if (this.templatePicker) {
      this.root.appendChild(this._renderTemplatePicker());
    }
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

    const fromTemplateBtn = document.createElement("button");
    fromTemplateBtn.textContent = "+ From template";
    fromTemplateBtn.className = "layer-tab new-layer-template";
    fromTemplateBtn.addEventListener("click", () => {
      this.templatePicker = { step: "list" };
      this.render();
    });
    bar.appendChild(fromTemplateBtn);

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
      const icon = slot && slot.icon ? this.icons.get(slot.icon) : null;
      if (icon) {
        // webapp-layer-editor: "editor SHALL display a preview of the
        // resulting 64x64 bitmap in that slot's grid cell" - mirrors the
        // firmware's icon-replaces-color-fill rendering.
        cell.style.background = "";
        cell.style.backgroundImage = `url(${icon.previewCanvas.toDataURL()})`;
        cell.style.backgroundSize = "cover";
      } else {
        cell.style.backgroundImage = "";
        cell.style.background = slot ? slot.color : "";
      }
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
      icon: "",
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
    panel.appendChild(this._renderIconField(slot));

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

  // webapp-layer-editor: "Editor allows uploading an icon for a button
  // slot" / "Editor supports clearing a slot's icon independently of its
  // other fields". The upload+preview flow uses this.icons as the id ->
  // bitmap cache; app.js's BLE sync uploads/downloads against the same map.
  _renderIconField(slot) {
    const wrap = document.createElement("div");

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      convertImageToIcon(file).then(({ id, bytes, previewCanvas }) => {
        // webapp-layer-editor: "uploading an identical image for a
        // different slot reuses the id instead of creating a duplicate" -
        // convertImageToIcon's content-hash id already guarantees this.
        this.icons.set(id, { bytes, previewCanvas });
        slot.icon = id;
        this._commitSlot(slot);
        this.render();
      });
    });
    wrap.appendChild(this._field("Upload icon", fileInput));

    if (slot.icon) {
      const clearBtn = document.createElement("button");
      clearBtn.textContent = "Clear icon";
      clearBtn.addEventListener("click", () => {
        slot.icon = "";
        this._commitSlot(slot);
        this.render();
      });
      wrap.appendChild(clearBtn);
    }

    return wrap;
  }

  _renderTemplatePicker() {
    const panel = document.createElement("div");
    panel.className = "template-picker";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Cancel";
    closeBtn.addEventListener("click", () => {
      this.templatePicker = null;
      this.render();
    });

    if (this.templatePicker.step === "list") {
      const heading = document.createElement("p");
      heading.textContent = "Choose a template:";
      panel.appendChild(heading);

      for (const template of TEMPLATES) {
        const btn = document.createElement("button");
        btn.className = "template-option";
        const name = document.createElement("strong");
        name.textContent = template.name;
        const desc = document.createElement("div");
        desc.textContent = template.description;
        btn.appendChild(name);
        btn.appendChild(desc);
        btn.addEventListener("click", () => {
          this.templatePicker = { step: "preview", templateId: template.id };
          this.render();
        });
        panel.appendChild(btn);
      }
      panel.appendChild(closeBtn);
      return panel;
    }

    // step === "preview"
    const template = findTemplate(this.templatePicker.templateId);
    const heading = document.createElement("p");
    heading.textContent = `${template.name}: `;
    panel.appendChild(heading);

    const list = document.createElement("ul");
    for (const slot of template.buttons) {
      if (!slot) continue;
      const item = document.createElement("li");
      item.textContent = slot.requiresSetup
        ? `${slot.label} - ${slot.setupNote}`
        : slot.label;
      list.appendChild(item);
    }
    panel.appendChild(list);

    const idInput = this._input("text", "", () => {});
    panel.appendChild(this._field("New layer id", idInput));

    const createBtn = document.createElement("button");
    createBtn.textContent = "Create layer";
    createBtn.addEventListener("click", () => {
      this._createLayerFromTemplate(template, idInput.value);
    });
    panel.appendChild(createBtn);
    panel.appendChild(closeBtn);

    return panel;
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
    if (!this._reserveLayerId(id)) return;
    this.config.layers[id] = { buttons: new Array(BUTTONS_PER_LAYER).fill(null) };
    this.currentLayerId = id;
    this.onChange(this.config);
    this.render();
  }

  // Shared duplicate-id check used by both the empty-layer and
  // create-from-template paths (webapp-layer-editor: "creating a layer from
  // a template SHALL be subject to the same duplicate-id handling as
  // creating an empty layer").
  _reserveLayerId(id) {
    if (this.config.layers[id]) {
      window.alert(`Layer "${id}" already exists.`);
      return false;
    }
    return true;
  }

  // webapp-layer-templates: template buttons get a procedurally-generated
  // icon by default (see glyphs.js). Each iconGlyph is rendered and run
  // through the same conversion pipeline as a user-uploaded image, so the
  // result lands in this.icons and on the slot's `icon` field exactly like
  // an upload would - no separate code path for the rest of the system to
  // know about.
  async _createLayerFromTemplate(template, id) {
    if (!id) return;
    if (!this._reserveLayerId(id)) return;
    const layer = applyTemplate(template, id);

    for (let index = 0; index < template.buttons.length; index++) {
      const templateSlot = template.buttons[index];
      if (!templateSlot || !templateSlot.iconGlyph) continue;
      const { id: iconId, bytes, previewCanvas } = await generateGlyphIcon(
        templateSlot.iconGlyph,
        templateSlot.color,
      );
      this.icons.set(iconId, { bytes, previewCanvas });
      layer.buttons[index].icon = iconId;
    }

    this.config.layers[id] = { buttons: layer.buttons };
    this.currentLayerId = id;
    this.templatePicker = null;
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
