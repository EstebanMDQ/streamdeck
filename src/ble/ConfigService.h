#pragma once

#include <functional>

#include "macropad_config/Config.h"

// Custom BLE GATT service exposing ConfigTransfer/ConfigDump/ConfigStatus.
// Implements:
//   openspec/changes/add-macropad-mvp/specs/macropad-ble-config-protocol/spec.md
// ESP32-only - not part of the native test build (the pure chunk-framing and
// validation logic it calls into IS unit tested, in macropad_transfer and
// macropad_config respectively).
//
// IMPORTANT: must be started AFTER HidService::begin(), because that's what
// calls BLEDevice::init() - required once before ConfigService can create
// its own BLEServer via BLEDevice::createServer(). ConfigService does NOT
// try to reuse HidService/BleKeyboard's BLEServer (this library's
// BLEDevice has no public accessor for an already-created server) - it
// creates its own second one instead, which is supported (each
// createServer() call registers an independent GATT application) and
// avoids the two modules ever needing to share a BLEServerCallbacks slot.
// Both servers' services still advertise together, since
// BLEDevice::getAdvertising() is a single device-level advertiser shared
// across every server instance.

namespace macropad {

using ConfigAppliedCallback = std::function<void(const MacroConfig&)>;

class ConfigService {
 public:
  void begin();

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
