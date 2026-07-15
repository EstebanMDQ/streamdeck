#include "storage/ConfigStorage.h"

#include <LittleFS.h>

namespace macropad {

namespace {
constexpr const char* kConfigPath = "/config.json";
constexpr const char* kTempPath = "/config.json.tmp";
}  // namespace

bool ConfigStorage::begin() {
  // `true` = format LittleFS if mounting fails (e.g. first boot ever).
  return LittleFS.begin(true);
}

MacroConfig ConfigStorage::load() {
  MacroConfig config;

  File f = LittleFS.open(kConfigPath, "r");
  if (!f) {
    return defaultConfig();
  }

  std::string json;
  json.reserve(f.size());
  while (f.available()) {
    json += static_cast<char>(f.read());
  }
  f.close();

  ApplyResult result = parseAndValidate(json, config);
  if (result != ApplyResult::Applied) {
    return defaultConfig();
  }
  return config;
}

bool ConfigStorage::save(const MacroConfig& config) {
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

}  // namespace macropad
