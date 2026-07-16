// Serialize/deserialize a portable backup file: the current configuration
// plus the bitmap bytes for every icon it references, as a single JSON
// document. Pure logic - no DOM/BLE dependency - so it's unit-testable
// without a browser, same pattern as ble-protocol.js and icon.js's
// non-Canvas pieces. Implements:
//   openspec/changes/add-config-export-import/specs/webapp-config-backup/spec.md

import { ICON_BYTES } from "./icon.js";
import { collectIconIds } from "./validation.js";

export const BACKUP_FORMAT_VERSION = 1;

// btoa/atob operate on binary strings, not Uint8Arrays directly, and calling
// String.fromCharCode(...bytes) directly can blow the call stack on large
// inputs - chunk it so this stays safe regardless of icon count/size.
const CHUNK_SIZE = 0x8000;

export function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

export function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// `icons` is the full id -> {bytes, ...} map the editor currently holds (e.g.
// Editor.icons) - only entries actually referenced by `config` are included
// in the output. That map accumulates unrelated entries across a whole
// session (every device connected to, every template applied), which have
// nothing to do with the configuration being exported.
export function serializeBackup(config, icons) {
  const referencedIds = collectIconIds(config);
  const encodedIcons = {};
  for (const id of referencedIds) {
    const icon = icons.get(id);
    if (!icon) continue; // referenced but not locally known - omitted, same as a never-uploaded icon
    encodedIcons[id] = bytesToBase64(icon.bytes);
  }
  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    config,
    icons: encodedIcons,
  };
}

// Parses `text` (a backup file's raw contents) into
// { config, icons: Map<id, Uint8Array>, skippedIconIds: string[] }. Throws a
// clear Error if `text` isn't valid JSON or is missing required fields -
// that's a genuinely unreadable file, not a per-icon problem. A per-icon
// entry with the wrong decoded byte length is NOT thrown for - it's dropped
// and its id collected in skippedIconIds, since the rest of the backup is
// still perfectly usable without it (same graceful fallback as a
// never-uploaded icon on-device).
export function deserializeBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Backup file is not valid JSON: ${err.message}`);
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !parsed.config ||
    typeof parsed.config !== "object"
  ) {
    throw new Error("Backup file is missing its configuration.");
  }

  const icons = new Map();
  const skippedIconIds = [];
  const rawIcons =
    parsed.icons && typeof parsed.icons === "object" ? parsed.icons : {};

  for (const [id, base64] of Object.entries(rawIcons)) {
    let bytes;
    try {
      bytes = base64ToBytes(base64);
    } catch {
      skippedIconIds.push(id);
      continue;
    }
    if (bytes.length !== ICON_BYTES) {
      skippedIconIds.push(id);
      continue;
    }
    icons.set(id, bytes);
  }

  return { config: parsed.config, icons, skippedIconIds };
}
