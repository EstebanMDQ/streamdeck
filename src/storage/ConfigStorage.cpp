#include "storage/ConfigStorage.h"

#include <LittleFS.h>
#include <SD.h>
#include <SPI.h>

namespace macropad {

namespace {
constexpr const char* kConfigPath = "/config.json";
constexpr const char* kTempPath = "/config.json.tmp";

constexpr const char* kSdBackupPath = "/streamdeck-config.json";
constexpr const char* kSdBackupTempPath = "/streamdeck-config.json.tmp";

// SD card CS pin per the commonly documented ESP32-2432S028R pin map -
// shares the TFT's SPI bus (MISO 12/MOSI 13/SCK 14), different CS only.
// Unverified against the physical unit - see tasks.md 3.1.
constexpr int kSdCsPin = 5;

// The SD backup is explicitly a source that may contain a foreign or
// corrupted file (different card, different device, interrupted write) -
// reject anything larger than this before reading it into memory, rather
// than allocating a buffer sized to whatever is on the card.
constexpr size_t kSdBackupMaxBytes = 64 * 1024;

}  // namespace

bool ConfigStorage::begin() {
  // `true` = format LittleFS if mounting fails (e.g. first boot ever).
  return LittleFS.begin(true);
}

MacroConfig ConfigStorage::load() {
  MacroConfig config;

  File f = LittleFS.open(kConfigPath, "r");
  if (f) {
    std::string json;
    json.reserve(f.size());
    while (f.available()) {
      json += static_cast<char>(f.read());
    }
    f.close();

    if (parseAndValidate(json, config) == ApplyResult::Applied) {
      return config;
    }
  }

  // Internal config missing or invalid - try the SD backup.
  if (loadFromSdIfValid(config)) {
    saveToLittleFs(config);  // self-heal internal storage from the backup
    return config;
  }

  return defaultConfig();
}

bool ConfigStorage::save(const MacroConfig& config) {
  bool internalOk = saveToLittleFs(config);
  // Best-effort: SD outcome never affects the return value, per
  // macropad-config-storage's "mirrored... as a best-effort backup"
  // requirement.
  backupToSd(config);
  return internalOk;
}

bool ConfigStorage::saveToLittleFs(const MacroConfig& config) {
  std::string json = serialize(config);

  File f = LittleFS.open(kTempPath, "w");
  if (!f) {
    return false;
  }
  size_t written = f.print(json.c_str());
  f.close();
  if (written != json.size()) {
    LittleFS.remove(kTempPath);
    return false;
  }

  // Atomic swap: remove the old file, then rename the fully-written temp
  // file over it. If power is lost before this point, the previous
  // kConfigPath is untouched; if lost after, the rename already completed.
  LittleFS.remove(kConfigPath);
  return LittleFS.rename(kTempPath, kConfigPath);
}

bool ConfigStorage::backupToSd(const MacroConfig& config) {
  if (!SD.begin(kSdCsPin)) {
    return false;  // no card inserted, or mount failed - best-effort, no-op
  }

  std::string json = serialize(config);
  bool ok = false;

  File f = SD.open(kSdBackupTempPath, "w");
  if (f) {
    size_t written = f.print(json.c_str());
    f.close();
    if (written == json.size()) {
      SD.remove(kSdBackupPath);
      ok = SD.rename(kSdBackupTempPath, kSdBackupPath);
    } else {
      SD.remove(kSdBackupTempPath);
    }
  }

  SD.end();
  return ok;
}

bool ConfigStorage::loadFromSdIfValid(MacroConfig& outConfig) {
  if (!SD.begin(kSdCsPin)) {
    return false;  // no card inserted, or mount failed
  }

  bool ok = false;
  File f = SD.open(kSdBackupPath, "r");
  if (f) {
    if (f.size() <= kSdBackupMaxBytes) {
      std::string json;
      json.reserve(f.size());
      while (f.available()) {
        json += static_cast<char>(f.read());
      }
      ok = parseAndValidate(json, outConfig) == ApplyResult::Applied;
    }
    // Oversized file: treated as invalid without reading its contents into
    // memory - see macropad-config-storage's size-cap requirement.
    f.close();
  }

  SD.end();
  return ok;
}

}  // namespace macropad
