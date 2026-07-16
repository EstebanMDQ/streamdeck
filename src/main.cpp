#include <Arduino.h>

#include "ble/ConfigService.h"
#include "ble/HidService.h"
#include "display/DisplayManager.h"
#include "macropad_config/Config.h"
#include "storage/ConfigStorage.h"

namespace {

macropad::HidService hidService;
macropad::ConfigService configService;
macropad::DisplayManager displayManager;

}  // namespace

void setup() {
  Serial.begin(115200);
  Serial.println("Streamdeck CYD firmware booting...");

  bool fsOk = macropad::ConfigStorage::begin();
  if (!fsOk) {
    Serial.println("LittleFS mount failed - proceeding with default config");
  }
  macropad::MacroConfig config = macropad::ConfigStorage::load();

  displayManager.begin();
  displayManager.setConfig(config);
  displayManager.setActionCallback([](const macropad::ButtonAction& action) {
    hidService.sendAction(action);
  });

  // HidService must start first: ConfigService attaches its service to the
  // SAME BLEServer HidService creates, rather than creating a second one
  // (see HidService.h/ConfigService.h for why that's required, not just
  // preferred).
  hidService.begin("Streamdeck CYD");
  configService.begin(hidService.getServer());
  configService.setConfigAppliedCallback(
      [](const macropad::MacroConfig& newConfig) {
        displayManager.setConfig(newConfig);
      });
}

void loop() {
  displayManager.setHidConnected(hidService.isConnected());
  displayManager.loop();
  configService.loop();
}
