// Shared config model constants/helpers. Pure logic, no DOM/BLE dependency -
// mirrors lib/macropad_config/include/macropad_config/Config.h exactly so
// firmware and webapp agree on the wire format (see design.md's config
// schema decision).

export const SCHEMA_VERSION = 1;
export const BUTTONS_PER_LAYER = 6;

export const MEDIA_KEYS = [
  "play_pause",
  "next",
  "prev",
  "vol_up",
  "vol_down",
  "mute",
];

export const MODIFIERS = ["ctrl", "shift", "alt", "gui"];

export function createEmptyLayer(id) {
  return {
    id,
    buttons: new Array(BUTTONS_PER_LAYER).fill(null),
  };
}

export function createEmptyConfig() {
  return {
    schemaVersion: SCHEMA_VERSION,
    rootLayer: "root",
    layers: {
      root: { buttons: new Array(BUTTONS_PER_LAYER).fill(null) },
    },
  };
}

export function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}
