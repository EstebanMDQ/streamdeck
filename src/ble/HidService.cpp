#include "ble/HidService.h"

#include <Arduino.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEHIDDevice.h>
#include <BLESecurity.h>
#include <BLEServer.h>
#include <HIDTypes.h>

namespace macropad {

namespace {

constexpr uint8_t kKeyboardReportId = 1;
constexpr uint8_t kConsumerReportId = 2;

// Standard USB HID boot-keyboard report (8 bytes: 1 modifier byte, 1
// reserved byte, 6 keycode bytes) plus a 1-byte consumer-control bitmap
// report for a fixed set of media keys. Written from scratch against the
// public USB-IF HID Usage Tables (Usage Page 0x07 = Keyboard/Keypad, Usage
// Page 0x0C = Consumer) and this framework's own HIDTypes.h macros - not
// copied from any third-party HID keyboard library.
// clang-format off
const uint8_t kReportDescriptor[] = {
    USAGE_PAGE(1),      0x01,               // Generic Desktop
    USAGE(1),           0x06,               // Keyboard
    COLLECTION(1),      0x01,               // Application
      REPORT_ID(1),     kKeyboardReportId,
      USAGE_PAGE(1),    0x07,               //   Keyboard/Keypad
      USAGE_MINIMUM(1), 0xE0,
      USAGE_MAXIMUM(1), 0xE7,
      LOGICAL_MINIMUM(1), 0x00,
      LOGICAL_MAXIMUM(1), 0x01,
      REPORT_SIZE(1),   0x01,
      REPORT_COUNT(1),  0x08,
      HIDINPUT(1),      0x02,               //   modifier byte (8 bits, variable)
      REPORT_COUNT(1),  0x01,
      REPORT_SIZE(1),   0x08,
      HIDINPUT(1),      0x01,               //   reserved byte (constant)
      REPORT_COUNT(1),  0x06,
      REPORT_SIZE(1),   0x08,
      LOGICAL_MINIMUM(1), 0x00,
      LOGICAL_MAXIMUM(1), 0x65,
      USAGE_PAGE(1),    0x07,
      USAGE_MINIMUM(1), 0x00,
      USAGE_MAXIMUM(1), 0x65,
      HIDINPUT(1),      0x00,               //   6 keycode bytes
    END_COLLECTION(0),

    USAGE_PAGE(1),      0x0C,               // Consumer
    USAGE(1),           0x01,               // Consumer Control
    COLLECTION(1),      0x01,               // Application
      REPORT_ID(1),     kConsumerReportId,
      USAGE_PAGE(1),    0x0C,
      LOGICAL_MINIMUM(1), 0x00,
      LOGICAL_MAXIMUM(1), 0x01,
      REPORT_SIZE(1),   0x01,
      REPORT_COUNT(1),  0x06,               //   6 meaningful one-bit fields
      USAGE(1),         0xB5,               //   Scan Next Track     (bit 0)
      USAGE(1),         0xB6,               //   Scan Previous Track (bit 1)
      USAGE(1),         0xCD,               //   Play/Pause          (bit 2)
      USAGE(1),         0xE2,               //   Mute                (bit 3)
      USAGE(1),         0xE9,               //   Volume Up           (bit 4)
      USAGE(1),         0xEA,               //   Volume Down         (bit 5)
      HIDINPUT(1),      0x02,
      REPORT_COUNT(1),  0x01,
      REPORT_SIZE(1),   0x02,
      HIDINPUT(1),      0x01,               //   2 padding bits (rounds out to 1 byte)
    END_COLLECTION(0),
};
// clang-format on

struct KeyboardReport {
  uint8_t modifiers = 0;
  uint8_t reserved = 0;
  uint8_t keys[6] = {0, 0, 0, 0, 0, 0};
};

BLEServer* gServer = nullptr;
BLEHIDDevice* gHid = nullptr;
BLECharacteristic* gKeyboardInputChar = nullptr;
BLECharacteristic* gConsumerInputChar = nullptr;
bool gConnected = false;

uint8_t modifierBit(const std::string& mod) {
  if (mod == "ctrl") return 0x01;
  if (mod == "shift") return 0x02;
  if (mod == "alt") return 0x04;
  if (mod == "gui") return 0x08;
  return 0;
}

uint8_t consumerBit(const std::string& mediaKey) {
  if (mediaKey == "next") return 0x01;
  if (mediaKey == "prev") return 0x02;
  if (mediaKey == "play_pause") return 0x04;
  if (mediaKey == "mute") return 0x08;
  if (mediaKey == "vol_up") return 0x10;
  if (mediaKey == "vol_down") return 0x20;
  return 0;
}

class HidServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) override {
    (void)server;
    gConnected = true;
    Serial.println("HID: host connected");
  }
  void onDisconnect(BLEServer* server) override {
    (void)server;
    gConnected = false;
    Serial.println("HID: host disconnected, resuming advertising");
    // Resume advertising so a new host (or the same one reconnecting) can
    // find the device again.
    gServer->getAdvertising()->start();
  }
};

HidServerCallbacks gServerCallbacks;

}  // namespace

void HidService::begin(const std::string& deviceName) {
  BLEDevice::init(deviceName);
  gServer = BLEDevice::createServer();
  gServer->setCallbacks(&gServerCallbacks);

  gHid = new BLEHIDDevice(gServer);
  gKeyboardInputChar = gHid->inputReport(kKeyboardReportId);
  gConsumerInputChar = gHid->inputReport(kConsumerReportId);

  // BLEHIDDevice::manufacturer(std::string) looks like a setter but isn't
  // safe to call on its own: it writes through m_manufacturerCharacteristic,
  // which is only ever created inside the OTHER, no-arg manufacturer()
  // overload (confirmed in BLEHIDDevice.cpp - the setter has no fallback
  // creation logic). Calling the setter directly dereferences an
  // uninitialized pointer and crashes (LoadProhibited) - this was the
  // actual cause of the on-device crash-loop/"flashing" symptom, not a BLE
  // pairing issue. Call the getter first, as intended.
  gHid->manufacturer()->setValue("DIY");
  gHid->pnp(0x02, 0x05ac, 0x820a, 0x0210);
  gHid->hidInfo(0x00, 0x01);

  // Secure Connections + Bonding, deliberately WITHOUT requiring MITM
  // protection: this device has no passkey-entry UI, so demanding MITM
  // (which requires satisfying an I/O-capability-based authentication step)
  // left pairing with no way to actually complete - the host would connect,
  // fail that step, and disconnect/retry in a loop (visible on-device as
  // the idle screen flashing, since each connect/disconnect flips the
  // idle/connected display state). Just Works pairing is standard for BLE
  // HID keyboards without dedicated input/display hardware for pairing.
  BLESecurity* security = new BLESecurity();
  security->setAuthenticationMode(ESP_LE_AUTH_REQ_SC_BOND);

  gHid->reportMap(const_cast<uint8_t*>(kReportDescriptor),
                   sizeof(kReportDescriptor));
  gHid->startServices();
  gHid->setBatteryLevel(100);

  BLEAdvertising* advertising = gServer->getAdvertising();
  advertising->setAppearance(HID_KEYBOARD);
  advertising->addServiceUUID(gHid->hidService()->getUUID());
  advertising->setScanResponse(false);
  advertising->start();
}

bool HidService::isConnected() const { return gConnected; }

BLEServer* HidService::getServer() const { return gServer; }

void HidService::sendAction(const ButtonAction& action) {
  if (!gConnected) {
    return;
  }

  if (action.type == ActionType::Key) {
    KeyboardReport report;
    for (const auto& mod : action.modifiers) {
      report.modifiers |= modifierBit(mod);
    }
    report.keys[0] = static_cast<uint8_t>(action.keyUsage);
    gKeyboardInputChar->setValue(reinterpret_cast<uint8_t*>(&report),
                                 sizeof(report));
    gKeyboardInputChar->notify();
    delay(10);

    KeyboardReport release;
    gKeyboardInputChar->setValue(reinterpret_cast<uint8_t*>(&release),
                                 sizeof(release));
    gKeyboardInputChar->notify();
  } else if (action.type == ActionType::Media) {
    uint8_t press = consumerBit(action.mediaKey);
    gConsumerInputChar->setValue(&press, 1);
    gConsumerInputChar->notify();
    delay(10);

    uint8_t release = 0;
    gConsumerInputChar->setValue(&release, 1);
    gConsumerInputChar->notify();
  }
  // Layer actions never reach here - DisplayManager handles them locally
  // without emitting any HID report (macropad-ble-hid requirement).
}

}  // namespace macropad
