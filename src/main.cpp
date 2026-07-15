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

  // HidService must start first: it creates the shared BLEServer that
  // ConfigService attaches its custom service to (see HidService.h/
  // ConfigService.h for why).
  hidService.begin("Streamdeck CYD");
  configService.begin();
  configService.setConfigAppliedCallback(
      [](const macropad::MacroConfig& newConfig) {
        displayManager.setConfig(newConfig);
      });
}

void loop() {
  displayManager.loop();
  configService.loop();
}
