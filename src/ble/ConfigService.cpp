#include "ble/ConfigService.h"

#include <Arduino.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>

#include <algorithm>

#include "assets/IconStorage.h"
#include "macropad_transfer/ChunkReassembler.h"
#include "storage/ConfigStorage.h"

namespace macropad {

namespace {

constexpr const char* kFirmwareVersion = "0.1.0";

// Custom 128-bit UUIDs for the config GATT service. Arbitrary but fixed -
// must match webapp/js/ble-sync.js exactly.
constexpr const char* kServiceUuid = "8f8c1701-4a2f-4f1a-9d1e-9f7f6c2b1a01";
constexpr const char* kConfigTransferUuid =
    "8f8c1702-4a2f-4f1a-9d1e-9f7f6c2b1a01";
constexpr const char* kConfigDumpUuid = "8f8c1703-4a2f-4f1a-9d1e-9f7f6c2b1a01";
constexpr const char* kConfigStatusUuid =
    "8f8c1704-4a2f-4f1a-9d1e-9f7f6c2b1a01";

// Icon transfer characteristics (macropad-icon-assets) - same service, new
// UUIDs. Must match webapp/js/ble-sync.js exactly.
constexpr const char* kIconTransferIdUuid =
    "8f8c1705-4a2f-4f1a-9d1e-9f7f6c2b1a01";
constexpr const char* kIconUploadUuid = "8f8c1706-4a2f-4f1a-9d1e-9f7f6c2b1a01";
constexpr const char* kIconDownloadUuid =
    "8f8c1707-4a2f-4f1a-9d1e-9f7f6c2b1a01";
constexpr const char* kIconStatusUuid = "8f8c1708-4a2f-4f1a-9d1e-9f7f6c2b1a01";

// Conservative chunk size, comfortably under a negotiated BLE MTU. Pacing
// between notifications may need tuning against real hardware - see
// tasks.md 6.6.
constexpr size_t kMaxChunkPayload = 180;
constexpr uint32_t kNotifyPacingMs = 20;

BLEServer* gConfigServer = nullptr;
BLECharacteristic* gConfigTransferChar = nullptr;
BLECharacteristic* gConfigDumpChar = nullptr;
BLECharacteristic* gConfigStatusChar = nullptr;

BLECharacteristic* gIconUploadChar = nullptr;
BLECharacteristic* gIconDownloadChar = nullptr;
BLECharacteristic* gIconStatusChar = nullptr;

ChunkReassembler gReassembler;
ChunkReassembler gIconReassembler;
ConfigAppliedCallback gOnConfigApplied;
int gLastConnectedCount = 0;

// Icon transfer target, set via IconTransferId before an IconUpload write or
// IconDownload read - see macropad-icon-assets's "transfer target
// characteristic" requirement. Empty means no target has ever been set.
std::string gPendingIconId;

enum class IconResult { None, Uploaded, RejectedWrongSize, Downloaded, NotFound };

const char* iconResultName(IconResult result) {
  switch (result) {
    case IconResult::Uploaded:
      return "uploaded";
    case IconResult::RejectedWrongSize:
      return "rejected_wrong_size";
    case IconResult::Downloaded:
      return "downloaded";
    case IconResult::NotFound:
      return "not_found";
    case IconResult::None:
    default:
      return "none";
  }
}

void publishIconStatus(IconResult result) {
  if (!gIconStatusChar) return;
  std::string json =
      std::string("{\"lastResult\":\"") + iconResultName(result) + "\"}";
  gIconStatusChar->setValue(reinterpret_cast<uint8_t*>(&json[0]), json.size());
  gIconStatusChar->notify();
}

const char* applyResultName(ApplyResult result) {
  switch (result) {
    case ApplyResult::Applied:
      return "applied";
    case ApplyResult::RejectedInvalidJson:
      return "rejected_invalid_json";
    case ApplyResult::RejectedSchemaVersion:
      return "rejected_schema_version";
    case ApplyResult::RejectedStructure:
      return "rejected_structure";
    case ApplyResult::None:
    default:
      return "none";
  }
}

void publishStatus(ApplyResult lastResult) {
  if (!gConfigStatusChar) return;
  std::string json = std::string("{\"firmwareVersion\":\"") +
                      kFirmwareVersion +
                      "\",\"schemaVersion\":" + std::to_string(kSchemaVersion) +
                      ",\"lastApplyResult\":\"" + applyResultName(lastResult) +
                      "\"}";
  gConfigStatusChar->setValue(reinterpret_cast<uint8_t*>(&json[0]),
                              json.size());
  gConfigStatusChar->notify();
}

std::string frameChunk(uint16_t totalLength, uint16_t offset,
                        const std::string& source, size_t chunkOffset,
                        size_t chunkLen) {
  std::string frame;
  frame.push_back(static_cast<char>(totalLength & 0xFF));
  frame.push_back(static_cast<char>((totalLength >> 8) & 0xFF));
  frame.push_back(static_cast<char>(offset & 0xFF));
  frame.push_back(static_cast<char>((offset >> 8) & 0xFF));
  frame.append(source, chunkOffset, chunkLen);
  return frame;
}

// Streams the current on-disk configuration out over ConfigDump using the
// same [totalLength][offset][payload] framing as ConfigTransfer. Triggered
// when the webapp reads ConfigDump (see ConfigDumpCallbacks::onRead below) -
// the webapp is expected to subscribe to notifications first, then issue a
// read to kick this off; the actual chunks arrive via notify(), not as the
// read's own response value.
void sendConfigDump() {
  if (!gConfigDumpChar) return;

  MacroConfig current = ConfigStorage::load();
  std::string json = serialize(current);
  uint16_t totalLength = static_cast<uint16_t>(json.size());

  size_t offset = 0;
  do {
    size_t chunkLen = std::min(kMaxChunkPayload, json.size() - offset);
    std::string frame =
        frameChunk(totalLength, static_cast<uint16_t>(offset), json, offset, chunkLen);
    gConfigDumpChar->setValue(
        reinterpret_cast<uint8_t*>(const_cast<char*>(frame.data())),
        frame.size());
    gConfigDumpChar->notify();
    offset += chunkLen;
    delay(kNotifyPacingMs);
  } while (offset < json.size());
}

class ConfigTransferCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    // BLECharacteristic::getValue() returns std::string in the
    // arduino-esp32 BLE library version this project's platformio.ini
    // actually pins (confirmed by building, not assumed from docs).
    std::string value = characteristic->getValue();
    ChunkResult result =
        gReassembler.feed(reinterpret_cast<const uint8_t*>(value.data()),
                          value.size(), millis());

    if (result != ChunkResult::Complete) {
      // Incomplete: wait for more chunks. Rejected: drop silently - the
      // spec doesn't define per-chunk error reporting, only the overall
      // apply result once a transfer completes.
      return;
    }

    MacroConfig config;
    ApplyResult applyResult = parseAndValidate(gReassembler.payload(), config);
    if (applyResult == ApplyResult::Applied) {
      ConfigStorage::save(config);
      if (gOnConfigApplied) {
        gOnConfigApplied(config);
      }
    }
    publishStatus(applyResult);
  }
};

class ConfigDumpCallbacks : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic* characteristic) override {
    (void)characteristic;
    sendConfigDump();
  }
};

// Sends a single zero-length framed chunk - used when an IconDownload is
// requested for an id with no stored icon (macropad-icon-assets: "responds
// with a zero-length payload rather than an error").
void sendEmptyIconDump() {
  if (!gIconDownloadChar) return;
  std::string frame = frameChunk(0, 0, std::string(), 0, 0);
  gIconDownloadChar->setValue(
      reinterpret_cast<uint8_t*>(const_cast<char*>(frame.data())),
      frame.size());
  gIconDownloadChar->notify();
}

// Streams the icon bitmap for gPendingIconId back over IconDownload using
// the same chunked framing as ConfigDump/ConfigTransfer.
void sendIconDump() {
  if (!gIconDownloadChar) return;

  std::string bytes;
  if (gPendingIconId.empty() || !IconStorage::load(gPendingIconId, bytes)) {
    sendEmptyIconDump();
    publishIconStatus(IconResult::NotFound);
    return;
  }

  uint16_t totalLength = static_cast<uint16_t>(bytes.size());
  size_t offset = 0;
  do {
    size_t chunkLen = std::min(kMaxChunkPayload, bytes.size() - offset);
    std::string frame = frameChunk(totalLength, static_cast<uint16_t>(offset),
                                    bytes, offset, chunkLen);
    gIconDownloadChar->setValue(
        reinterpret_cast<uint8_t*>(const_cast<char*>(frame.data())),
        frame.size());
    gIconDownloadChar->notify();
    offset += chunkLen;
    delay(kNotifyPacingMs);
  } while (offset < bytes.size());

  publishIconStatus(IconResult::Downloaded);
}

class IconTransferIdCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    gPendingIconId = characteristic->getValue();
    // A new transfer target discards any stale partial upload buffer -
    // macropad-icon-assets: "Only one icon transfer is in flight at a time".
    gIconReassembler.reset();
  }
};

class IconUploadCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    if (gPendingIconId.empty()) {
      // No transfer target has ever been set - discard silently, mirroring
      // ConfigTransfer's handling of chunks it can't attribute to a
      // legitimate transfer.
      return;
    }

    std::string value = characteristic->getValue();
    ChunkResult result =
        gIconReassembler.feed(reinterpret_cast<const uint8_t*>(value.data()),
                              value.size(), millis());
    if (result != ChunkResult::Complete) {
      return;
    }

    const std::string& payload = gIconReassembler.payload();
    bool saved = IconStorage::save(
        gPendingIconId, reinterpret_cast<const uint8_t*>(payload.data()),
        payload.size());
    publishIconStatus(saved ? IconResult::Uploaded
                             : IconResult::RejectedWrongSize);
  }
};

class IconDownloadCallbacks : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic* characteristic) override {
    (void)characteristic;
    sendIconDump();
  }
};

ConfigTransferCallbacks gConfigTransferCallbacks;
ConfigDumpCallbacks gConfigDumpCallbacks;
IconTransferIdCallbacks gIconTransferIdCallbacks;
IconUploadCallbacks gIconUploadCallbacks;
IconDownloadCallbacks gIconDownloadCallbacks;

}  // namespace

void ConfigService::begin(BLEServer* server) {
  // Attaches to the BLEServer HidService already created - see
  // ConfigService.h for why this must NOT create its own second server
  // (BLEDevice routes all GATT events through one static pointer that a
  // second createServer() call would overwrite, silently breaking the
  // first server).
  gConfigServer = server;

  BLEService* service = server->createService(kServiceUuid);

  gConfigTransferChar = service->createCharacteristic(
      kConfigTransferUuid, BLECharacteristic::PROPERTY_WRITE);
  gConfigTransferChar->setCallbacks(&gConfigTransferCallbacks);

  gConfigDumpChar = service->createCharacteristic(
      kConfigDumpUuid,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  gConfigDumpChar->addDescriptor(new BLE2902());
  gConfigDumpChar->setCallbacks(&gConfigDumpCallbacks);

  gConfigStatusChar = service->createCharacteristic(
      kConfigStatusUuid,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  gConfigStatusChar->addDescriptor(new BLE2902());

  // Icon transfer characteristics (macropad-icon-assets) - same service,
  // same chunk-framing approach as ConfigTransfer/ConfigDump/ConfigStatus
  // above, reusing the same ChunkReassembler class via gIconReassembler.
  BLECharacteristic* iconTransferIdChar = service->createCharacteristic(
      kIconTransferIdUuid, BLECharacteristic::PROPERTY_WRITE);
  iconTransferIdChar->setCallbacks(&gIconTransferIdCallbacks);

  gIconUploadChar = service->createCharacteristic(
      kIconUploadUuid, BLECharacteristic::PROPERTY_WRITE);
  gIconUploadChar->setCallbacks(&gIconUploadCallbacks);

  gIconDownloadChar = service->createCharacteristic(
      kIconDownloadUuid,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  gIconDownloadChar->addDescriptor(new BLE2902());
  gIconDownloadChar->setCallbacks(&gIconDownloadCallbacks);

  gIconStatusChar = service->createCharacteristic(
      kIconStatusUuid,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  gIconStatusChar->addDescriptor(new BLE2902());

  service->start();
  publishStatus(ApplyResult::None);
  publishIconStatus(IconResult::None);

  // Deliberately NOT calling BLEDevice::getAdvertising()->addServiceUUID()
  // here. Checked against the actual installed BLEAdvertising::start()
  // source: every service UUID it advertises gets expanded to a full
  // 128-bit (16-byte) entry, even 16-bit ones like HID's 0x1812. HID's UUID
  // (16 bytes) plus this service's own 128-bit UUID (16 bytes) is 32 bytes
  // of service-UUID data alone, already over the 31-byte cap on a single
  // legacy BLE advertising packet, before Flags/Appearance/name are even
  // added - so this service's UUID structurally cannot coexist with HID's
  // in the advertisement. The webapp instead finds the device by name
  // (see webapp/js/ble-sync.js's `namePrefix` filter), which HID's
  // advertising already reliably includes.
  gLastConnectedCount = server->getConnectedCount();
}

void ConfigService::setConfigAppliedCallback(ConfigAppliedCallback callback) {
  gOnConfigApplied = callback;
}

void ConfigService::loop() {
  if (!gConfigServer) return;

  int connectedCount = gConfigServer->getConnectedCount();
  if (connectedCount == 0 && gLastConnectedCount > 0) {
    gReassembler.reset();
    gIconReassembler.reset();
  }
  gLastConnectedCount = connectedCount;
}

}  // namespace macropad
