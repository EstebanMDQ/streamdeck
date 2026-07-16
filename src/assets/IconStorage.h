#pragma once

#include <string>

// LittleFS storage for icon bitmaps, addressed by id. Implements:
//   openspec/changes/add-image-buttons/specs/macropad-icon-assets/spec.md
// ESP32-only (uses the Arduino LittleFS API) - not part of the native test
// build. Size validation itself lives in the portable macropad_icon lib
// (see IconValidation.h) so it's unit-testable without hardware.

namespace macropad {

class IconStorage {
 public:
  // Saves `bytes` (length `length`) as the icon file for `iconId`, but only
  // if `length` is exactly the expected icon size (macropad_icon's
  // isValidIconSize()) - returns false and saves nothing otherwise.
  static bool save(const std::string& iconId, const uint8_t* bytes,
                    size_t length);

  // Loads the icon file for `iconId` into `outBytes`. Returns false (leaving
  // `outBytes` empty) if no file exists for that id.
  static bool load(const std::string& iconId, std::string& outBytes);

 private:
  static std::string pathFor(const std::string& iconId);
};

}  // namespace macropad
