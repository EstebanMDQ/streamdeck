#pragma once

#include "macropad_config/Config.h"

// LittleFS persistence for the active configuration. Implements:
//   openspec/changes/add-macropad-mvp/specs/macropad-config-storage/spec.md
// ESP32-only (uses the Arduino LittleFS API) - not part of the native test
// build.

namespace macropad {

class ConfigStorage {
 public:
  // Mounts LittleFS, formatting on first use if needed. Returns false on
  // failure; callers should still proceed with defaultConfig() in that case
  // rather than refusing to boot.
  static bool begin();

  // Loads the persisted configuration, falling back to defaultConfig() if
  // the file is missing, unparsable, or fails structural/schema validation.
  static MacroConfig load();

  // Writes `config` to a temp file and renames it over the active config
  // file, so a power loss mid-write can't corrupt the previously persisted
  // configuration.
  static bool save(const MacroConfig& config);
};

}  // namespace macropad
