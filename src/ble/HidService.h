#pragma once

#include <string>

#include "macropad_config/Config.h"

// BLE HID keyboard/consumer-control peripheral. Implements:
//   openspec/changes/add-macropad-mvp/specs/macropad-ble-hid/spec.md
// Wraps T-vK's ESP32-BLE-Keyboard library. ESP32-only - not part of the
// native test build.
//
// IMPORTANT for whoever wires ConfigService (see ConfigService.h): this
// class calls BLEDevice::init() (via BleKeyboard::begin()) exactly once.
// ConfigService::begin() must run AFTER this, since it needs BLEDevice::init()
// to have already happened before it can create its own second BLEServer.
// ConfigService does not depend on or reuse BleKeyboard's internal server -
// see ConfigService.h for why (this framework version's BLEDevice has no
// public accessor for an already-created server).

namespace macropad {

class HidService {
 public:
  void begin(const std::string& deviceName);
  bool isConnected() const;

  // Sends the HID report for a `key` or `media` action. No-op (and no
  // report is queued for later) if no host is currently connected -
  // macropad-ble-hid: "Actions are silently dropped when no host is
  // connected". `layer`-type actions are never passed here; DisplayManager
  // handles those locally.
  void sendAction(const ButtonAction& action);
};

}  // namespace macropad
