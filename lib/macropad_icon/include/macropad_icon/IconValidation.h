#pragma once

#include <cstddef>

// Pure, host-testable icon size validation. Implements:
//   openspec/changes/add-image-buttons/specs/macropad-icon-assets/spec.md
// No Arduino/ESP32 dependency - compiles and runs identically on-device and
// in the native unit test environment. Separated from the ESP32-only file
// I/O in src/assets/IconStorage.* so this check is unit-testable on its own.

namespace macropad {

constexpr int kIconWidth = 64;
constexpr int kIconHeight = 64;
constexpr int kIconBytesPerPixel = 2;  // RGB565
constexpr size_t kIconExpectedBytes =
    static_cast<size_t>(kIconWidth) * kIconHeight * kIconBytesPerPixel;

// An icon bitmap is valid only if it is exactly kIconExpectedBytes - no
// image header to parse, no partial/truncated files accepted.
bool isValidIconSize(size_t byteCount);

}  // namespace macropad
