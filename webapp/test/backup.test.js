import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BACKUP_FORMAT_VERSION,
  bytesToBase64,
  base64ToBytes,
  serializeBackup,
  deserializeBackup,
} from "../js/backup.js";
import { ICON_BYTES } from "../js/icon.js";

function sampleConfig(iconIds = []) {
  const buttons = new Array(6).fill(null);
  iconIds.forEach((id, i) => {
    buttons[i] = {
      label: `Btn ${i}`,
      color: "#264653",
      icon: id,
      action: { type: "key", usage: 4, modifiers: [] },
    };
  });
  return {
    schemaVersion: 1,
    rootLayer: "root",
    layers: { root: { buttons } },
  };
}

function fakeIconBytes(fillValue) {
  return new Uint8Array(ICON_BYTES).fill(fillValue);
}

test("bytesToBase64/base64ToBytes round-trip arbitrary bytes", () => {
  const original = new Uint8Array(ICON_BYTES);
  for (let i = 0; i < original.length; i++) original[i] = i % 256;
  const encoded = bytesToBase64(original);
  const decoded = base64ToBytes(encoded);
  assert.deepEqual(decoded, original);
});

test("serializeBackup includes only icons referenced by the config", () => {
  const config = sampleConfig(["icon-a"]);
  const icons = new Map([
    ["icon-a", { bytes: fakeIconBytes(1) }],
    ["icon-unrelated", { bytes: fakeIconBytes(2) }],
  ]);

  const backup = serializeBackup(config, icons);
  assert.equal(backup.backupFormatVersion, BACKUP_FORMAT_VERSION);
  assert.equal(backup.config, config);
  assert.deepEqual(Object.keys(backup.icons), ["icon-a"]);
});

test("serializeBackup omits a referenced icon the caller doesn't have bytes for", () => {
  const config = sampleConfig(["icon-a", "icon-missing"]);
  const icons = new Map([["icon-a", { bytes: fakeIconBytes(1) }]]);

  const backup = serializeBackup(config, icons);
  assert.deepEqual(Object.keys(backup.icons), ["icon-a"]);
});

test("serializeBackup -> deserializeBackup round-trips config and icon bytes unchanged", () => {
  const config = sampleConfig(["icon-a", "icon-b"]);
  const icons = new Map([
    ["icon-a", { bytes: fakeIconBytes(10) }],
    ["icon-b", { bytes: fakeIconBytes(20) }],
  ]);

  const backup = serializeBackup(config, icons);
  const restored = deserializeBackup(JSON.stringify(backup));

  assert.deepEqual(restored.config, config);
  assert.equal(restored.skippedIconIds.length, 0);
  assert.deepEqual(restored.icons.get("icon-a"), fakeIconBytes(10));
  assert.deepEqual(restored.icons.get("icon-b"), fakeIconBytes(20));
});

test("deserializeBackup drops a wrong-length icon entry and reports its id", () => {
  const config = sampleConfig(["icon-a"]);
  const backup = {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    config,
    icons: {
      "icon-a": bytesToBase64(new Uint8Array(10)), // wrong length
    },
  };

  const restored = deserializeBackup(JSON.stringify(backup));
  assert.equal(restored.icons.has("icon-a"), false);
  assert.deepEqual(restored.skippedIconIds, ["icon-a"]);
  // the rest of the backup (the config) still loads normally
  assert.deepEqual(restored.config, config);
});

test("deserializeBackup throws a clear error on invalid JSON", () => {
  assert.throws(() => deserializeBackup("{ not valid json"), /not valid JSON/);
});

test("deserializeBackup throws a clear error when config is missing", () => {
  assert.throws(
    () => deserializeBackup(JSON.stringify({ backupFormatVersion: 1 })),
    /missing its configuration/,
  );
});

test("deserializeBackup treats a missing icons field as no icons", () => {
  const config = sampleConfig();
  const restored = deserializeBackup(
    JSON.stringify({ backupFormatVersion: 1, config }),
  );
  assert.equal(restored.icons.size, 0);
  assert.deepEqual(restored.skippedIconIds, []);
});
