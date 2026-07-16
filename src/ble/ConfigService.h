#pragma once

#include <functional>

#include "macropad_config/Config.h"

class BLEServer;

// Custom BLE GATT service exposing ConfigTransfer/ConfigDump/ConfigStatus.
// Implements:
//   openspec/changes/add-macropad-mvp/specs/macropad-ble-config-protocol/spec.md
// ESP32-only - not part of the native test build (the pure chunk-framing and
// validation logic it calls into IS unit tested, in macropad_transfer and
// macropad_config respectively).
//
// IMPORTANT: attaches its service to the BLEServer HidService already
// created (via begin(server)), rather than creating its own. This
// framework's BLEDevice routes every GATT server event through a single
// static pointer that the most recent BLEDevice::createServer() call
// overwrites - a second independent server would silently stop receiving
// connect/disconnect/write events (confirmed by reading BLEDevice.cpp
// during hardware bring-up: a device that had a splash screen but never
// showed as connectable turned out to be exactly this). One real server,
// shared by both services, is the only architecture this framework
// actually supports correctly.

namespace macropad {

using ConfigAppliedCallback = std::function<void(const MacroConfig&)>;

class ConfigService {
 public:
  // `server` must be the same BLEServer HidService::begin() created
  // (HidService::getServer()) - see the note above for why.
  void begin(BLEServer* server);

  // Invoked with the newly applied configuration whenever a BLE push is
  // validated and accepted, so main.cpp can forward it to DisplayManager.
  void setConfigAppliedCallback(ConfigAppliedCallback callback);

  // Detects a BLE disconnect (via the shared server's connection count) and
  // discards any in-progress ConfigTransfer buffer when it happens
  // (macropad-ble-config-protocol: "Disconnect mid-transfer discards the
  // partial buffer"). Call from the main loop.
  void loop();
};

}  // namespace macropad
