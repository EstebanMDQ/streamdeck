#pragma once

#include <string>

#include "macropad_config/Config.h"

class BLEServer;

// BLE HID keyboard/consumer-control peripheral, implemented directly
// against this project's framework's own BLEHIDDevice/BLEServer APIs
// (Apache/MIT-licensed, part of arduino-esp32) rather than a third-party
// wrapper library - see design.md's "Own BLE HID implementation" decision
// for why. Implements:
//   openspec/changes/add-macropad-mvp/specs/macropad-ble-hid/spec.md
// ESP32-only - not part of the native test build.
//
// Owns the device's one and only BLEServer. ConfigService attaches its own
// service to THIS server (via getServer()) instead of creating a second
// one - creating a second BLEServer would silently break this one, since
// this framework's BLEDevice routes every GATT server event through a
// single static pointer that the most recent BLEDevice::createServer()
// call overwrites (confirmed by reading BLEDevice.cpp during hardware
// bring-up - see design.md).

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

  // The single BLEServer this service creates and owns. ConfigService
  // attaches its own service to this same object.
  BLEServer* getServer() const;
};

}  // namespace macropad
