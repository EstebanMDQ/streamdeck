#include "ble/HidService.h"

#include <Arduino.h>
#include <BleKeyboard.h>

namespace macropad {

namespace {

BleKeyboard bleKeyboard("Streamdeck CYD", "DIY", 100);

uint8_t modifierBit(const std::string& mod) {
  if (mod == "ctrl") return 0x01;
  if (mod == "shift") return 0x02;
  if (mod == "alt") return 0x04;
  if (mod == "gui") return 0x08;
  return 0;
}

}  // namespace

void HidService::begin(const std::string& deviceName) {
  (void)deviceName;  // device name is fixed at construction; see note above
  bleKeyboard.begin();
}

bool HidService::isConnected() const { return bleKeyboard.isConnected(); }

void HidService::sendAction(const ButtonAction& action) {
  if (!bleKeyboard.isConnected()) {
    return;
  }

  if (action.type == ActionType::Key) {
    uint8_t modMask = 0;
    for (const auto& m : action.modifiers) {
      modMask |= modifierBit(m);
    }
    if (modMask & 0x01) bleKeyboard.press(KEY_LEFT_CTRL);
    if (modMask & 0x02) bleKeyboard.press(KEY_LEFT_SHIFT);
    if (modMask & 0x04) bleKeyboard.press(KEY_LEFT_ALT);
    if (modMask & 0x08) bleKeyboard.press(KEY_LEFT_GUI);
    bleKeyboard.press(static_cast<uint8_t>(action.keyUsage));
    delay(10);
    bleKeyboard.releaseAll();
  } else if (action.type == ActionType::Media) {
    if (action.mediaKey == "play_pause") {
      bleKeyboard.write(KEY_MEDIA_PLAY_PAUSE);
    } else if (action.mediaKey == "next") {
      bleKeyboard.write(KEY_MEDIA_NEXT_TRACK);
    } else if (action.mediaKey == "prev") {
      bleKeyboard.write(KEY_MEDIA_PREVIOUS_TRACK);
    } else if (action.mediaKey == "vol_up") {
      bleKeyboard.write(KEY_MEDIA_VOLUME_UP);
    } else if (action.mediaKey == "vol_down") {
      bleKeyboard.write(KEY_MEDIA_VOLUME_DOWN);
    } else if (action.mediaKey == "mute") {
      bleKeyboard.write(KEY_MEDIA_MUTE);
    }
  }
  // Layer actions never reach here - DisplayManager handles them locally
  // without emitting any HID report (macropad-ble-hid requirement).
}

}  // namespace macropad
