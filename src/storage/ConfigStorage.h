#pragma once

#include "macropad_config/Config.h"

// LittleFS persistence for the active configuration, with a best-effort SD
// card backup/recovery path. Implements:
//   openspec/changes/add-macropad-mvp/specs/macropad-config-storage/spec.md
//   openspec/changes/add-sd-config-backup/specs/macropad-config-storage/spec.md
// ESP32-only (uses the Arduino LittleFS/SD APIs) - not part of the native
// test build.

namespace macropad {

class ConfigStorage {
 public:
  // Mounts LittleFS, formatting on first use if needed. Returns false on
  // failure; callers should still proceed with defaultConfig() in that case
  // rather than refusing to boot.
  static bool begin();

  // Three-tier boot recovery: internal LittleFS config if present and
  // valid; else a valid SD card backup (re-persisted to LittleFS if used,
  // self-healing internal storage); else defaultConfig(). The SD card is
  // mounted on demand only for this check and unmounted immediately after,
  // sharing the TFT's SPI bus only briefly.
  static MacroConfig load();

  // Writes `config` to a temp file and renames it over the active config
  // file (atomic - a power loss mid-write can't corrupt the previously
  // persisted configuration), then attempts a best-effort mirror to an SD
  // card if one is inserted. SD mount/write/unmount failures never affect
  // the return value - only the internal LittleFS write does.
  static bool save(const MacroConfig& config);

 private:
  static bool saveToLittleFs(const MacroConfig& config);
  static bool backupToSd(const MacroConfig& config);
  static bool loadFromSdIfValid(MacroConfig& outConfig);
};

}  // namespace macropad
