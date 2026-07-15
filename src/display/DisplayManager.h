#pragma once

#include <functional>
#include <string>
#include <vector>

#include "macropad_config/Config.h"

// Renders the active layer's 6-button grid on the ILI9341 display, reads
// touch input, and handles layer navigation. Implements:
//   openspec/changes/add-macropad-mvp/specs/macropad-display-ui/spec.md
// ESP32-only (TFT_eSPI + XPT2046_Touchscreen) - not part of the native test
// build; the navigation-stack/reset-to-root logic mirrors what's unit-tested
// indirectly through macropad_config, but the rendering/touch parts can only
// be verified on real hardware (see tasks.md 4.7).

namespace macropad {

// Invoked when a leaf button (key or media) is pressed, so BLE HID emission
// stays decoupled from display/touch code.
using ActionCallback = std::function<void(const ButtonAction&)>;

class DisplayManager {
 public:
  void begin();

  // Called on boot and again whenever a new configuration is applied (e.g.
  // via a BLE push). Resets navigation to the new root layer if the
  // currently displayed layer no longer exists in the new configuration.
  void setConfig(const MacroConfig& config);

  // Polls touch input and (re)renders as needed. Call from the main loop.
  void loop();

  void setActionCallback(ActionCallback callback) {
    actionCallback_ = callback;
  }

 private:
  void renderCurrentLayer();
  void handleTouch(int x, int y);
  void navigateTo(const std::string& layerId);
  void navigateBack();
  void flashSlotFeedback(int slotIndex);

  MacroConfig config_;
  std::vector<std::string> navigationStack_;
  ActionCallback actionCallback_;
  bool needsRedraw_ = true;
};

}  // namespace macropad
