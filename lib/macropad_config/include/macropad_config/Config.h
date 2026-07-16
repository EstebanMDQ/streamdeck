#pragma once

#include <string>
#include <vector>

// Pure, host-testable configuration model and validation logic. Implements
// the requirements in:
//   openspec/changes/add-macropad-mvp/specs/macropad-layer-model/spec.md
//   openspec/changes/add-macropad-mvp/specs/macropad-ble-config-protocol/spec.md
// This file has no Arduino/ESP32 dependency so it compiles and runs
// identically on-device and in the native unit test environment.

namespace macropad {

constexpr int kSchemaVersion = 1;
constexpr int kButtonsPerLayer = 6;

enum class ActionType { None, Key, Media, Layer };

enum class ApplyResult {
  None,
  Applied,
  RejectedInvalidJson,
  RejectedSchemaVersion,
  RejectedStructure
};

struct ButtonAction {
  ActionType type = ActionType::None;

  // Key action: usage is a USB HID keyboard usage ID (e.g. 4 = 'a', 6 = 'c').
  // modifiers is drawn only from {"ctrl", "shift", "alt", "gui"}.
  int keyUsage = 0;
  std::vector<std::string> modifiers;

  // Media action: one of the fixed vocabulary in isValidMediaKey().
  std::string mediaKey;

  // Layer action: id of another layer.
  std::string layerTarget;
};

struct ButtonSlot {
  bool present = false;
  std::string label;
  std::string color;  // "#rrggbb"
  ButtonAction action;

  // Optional icon id (see macropad-icon-assets) referencing a 64x64 RGB565
  // bitmap stored separately from this config. Empty means no icon - the
  // slot renders with its color fill only, exactly as before this field
  // existed. Not validated for existence here (see macropad-icon-assets'
  // spec) - only its presence/absence is structural.
  std::string icon;
};

struct Layer {
  std::string id;
  ButtonSlot buttons[kButtonsPerLayer];
};

struct MacroConfig {
  int schemaVersion = kSchemaVersion;
  std::string rootLayer;
  std::vector<Layer> layers;

  const Layer* findLayer(const std::string& id) const;
};

// The small built-in configuration loaded when no valid stored config exists.
MacroConfig defaultConfig();

// Parses and validates `json`: syntax, schemaVersion, and structural checks
// (six slots per layer, a recognized action.type, a recognized media key).
// Referential integrity of `layer` targets (does the target actually exist)
// is intentionally NOT checked here - see design.md's config schema section.
// On success, populates `outConfig` and returns ApplyResult::Applied.
// On failure, leaves `outConfig` untouched and returns the rejection reason.
ApplyResult parseAndValidate(const std::string& json, MacroConfig& outConfig);

// Serializes a configuration back to its canonical JSON form.
std::string serialize(const MacroConfig& config);

bool isValidMediaKey(const std::string& key);
bool isValidModifier(const std::string& modifier);

}  // namespace macropad
