// Web Bluetooth connect/pull/push flow. Implements:
//   openspec/changes/add-macropad-mvp/specs/webapp-ble-sync/spec.md
// Browser-only (uses navigator.bluetooth) - not unit tested directly, but
// built entirely on top of ble-protocol.js, which is.

import { SCHEMA_VERSION } from "./model.js";
import {
  encodeChunks,
  ChunkReassembler,
  ChunkStatus,
} from "./ble-protocol.js";

// Custom 128-bit UUIDs - must match src/ble/ConfigService.cpp exactly.
export const SERVICE_UUID = "8f8c1701-4a2f-4f1a-9d1e-9f7f6c2b1a01";
export const CONFIG_TRANSFER_UUID = "8f8c1702-4a2f-4f1a-9d1e-9f7f6c2b1a01";
export const CONFIG_DUMP_UUID = "8f8c1703-4a2f-4f1a-9d1e-9f7f6c2b1a01";
export const CONFIG_STATUS_UUID = "8f8c1704-4a2f-4f1a-9d1e-9f7f6c2b1a01";

// Must stay <= the firmware's kMaxChunkPayload (see ConfigService.cpp) and
// comfortably under a typical negotiated BLE MTU.
const MAX_CHUNK_PAYLOAD = 180;

export function isBluetoothSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

export class DeviceConnection {
  constructor() {
    this.device = null;
    this.server = null;
    this.transferChar = null;
    this.dumpChar = null;
    this.statusChar = null;
  }

  get isConnected() {
    return !!(this.device && this.device.gatt && this.device.gatt.connected);
  }

  async connect() {
    // Not filtering by name or service UUID here: the device's advertised
    // name has repeatedly shown up stale/cached in various OS Bluetooth
    // stacks during hardware bring-up (see design.md), so any filter risks
    // silently excluding the real device from the chooser instead of
    // failing loudly. Showing every nearby device and letting the user
    // pick visually is more robust - the config service stays reachable
    // post-connection via optionalServices regardless of what name/UUIDs
    // the chooser displayed it under.
    this.device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });
    this.server = await this.device.gatt.connect();
    const service = await this.server.getPrimaryService(SERVICE_UUID);
    this.transferChar = await service.getCharacteristic(CONFIG_TRANSFER_UUID);
    this.dumpChar = await service.getCharacteristic(CONFIG_DUMP_UUID);
    this.statusChar = await service.getCharacteristic(CONFIG_STATUS_UUID);
  }

  disconnect() {
    if (this.isConnected) {
      this.device.gatt.disconnect();
    }
  }

  async readStatus() {
    const value = await this.statusChar.readValue(); // a DataView
    const text = new TextDecoder().decode(value);
    return JSON.parse(text);
  }

  // webapp-ble-sync: "Webapp checks schema compatibility before pushing".
  async isSchemaCompatible() {
    const status = await this.readStatus();
    return status.schemaVersion === SCHEMA_VERSION;
  }

  // webapp-ble-sync: "Webapp pulls the current configuration before
  // editing". Subscribes to ConfigDump notifications, then issues a read to
  // trigger the firmware's chunked dump (see ConfigService.cpp's
  // onRead handler / sendConfigDump()).
  async pullConfig() {
    const reassembler = new ChunkReassembler();

    return new Promise((resolve, reject) => {
      const onNotify = (event) => {
        const bytes = new Uint8Array(event.target.value.buffer);
        const status = reassembler.feed(bytes);
        if (status === ChunkStatus.COMPLETE) {
          cleanup();
          try {
            resolve(JSON.parse(reassembler.payloadText()));
          } catch (err) {
            reject(err);
          }
        } else if (status === ChunkStatus.REJECTED) {
          cleanup();
          reject(new Error("Device sent an unexpected config dump chunk"));
        }
      };

      const cleanup = () => {
        this.dumpChar.removeEventListener(
          "characteristicvaluechanged",
          onNotify,
        );
      };

      this.dumpChar
        .startNotifications()
        .then(() => {
          this.dumpChar.addEventListener(
            "characteristicvaluechanged",
            onNotify,
          );
          return this.dumpChar.readValue();
        })
        .catch((err) => {
          cleanup();
          reject(err);
        });
    });
  }

  // webapp-ble-sync: "Webapp pushes edited configuration in chunks" and
  // "Webapp confirms the outcome of a push". Chunks are written with
  // response (design.md: write-with-response, not write-without-response),
  // then ConfigStatus.lastApplyResult is read to learn the actual outcome -
  // chunk delivery being acked isn't the same as the config being applied.
  async pushConfig(config) {
    const json = JSON.stringify(config);
    const bytes = new TextEncoder().encode(json);
    const chunks = encodeChunks(bytes, MAX_CHUNK_PAYLOAD);

    for (const chunk of chunks) {
      await this.transferChar.writeValueWithResponse(chunk);
    }

    return this.readStatus(); // { firmwareVersion, schemaVersion, lastApplyResult }
  }
}
