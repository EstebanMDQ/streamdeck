import { createEmptyConfig, SCHEMA_VERSION } from "./model.js";
import { isPushValid, collectIconIds } from "./validation.js";
import { Editor } from "./editor.js";
import { isBluetoothSupported, DeviceConnection } from "./ble-sync.js";
import { rgb565ToCanvas, ICON_WIDTH, ICON_HEIGHT } from "./icon.js";
import { serializeBackup, deserializeBackup } from "./backup.js";

const editorRoot = document.getElementById("editor-root");
const connectBtn = document.getElementById("connect-btn");
const pushBtn = document.getElementById("push-btn");
const statusEl = document.getElementById("status");
const unsupportedBanner = document.getElementById("unsupported-banner");
const downloadBackupBtn = document.getElementById("download-backup-btn");
const restoreBackupInput = document.getElementById("restore-backup-input");

let config = createEmptyConfig();
let connection = null;
// Icon ids confirmed present on the connected device (downloaded on connect,
// or successfully uploaded this session) - webapp-ble-sync: "doesn't already
// have" is checked against this set, not re-uploaded unconditionally. Reset
// on every fresh connect since it's scoped to the currently connected device.
let deviceIconIds = new Set();

const editor = new Editor(editorRoot, config, (updatedConfig) => {
  config = updatedConfig;
});

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = kind ? `status ${kind}` : "status";
}

// webapp-ble-sync: "Webapp detects unsupported browsers".
if (!isBluetoothSupported()) {
  unsupportedBanner.hidden = false;
  connectBtn.disabled = true;
  pushBtn.disabled = true;
} else {
  editor.render();
}

connectBtn.addEventListener("click", async () => {
  try {
    setStatus("Connecting...", "pending");
    connection = new DeviceConnection();
    await connection.connect();

    setStatus("Connected. Pulling current configuration...", "pending");
    config = await connection.pullConfig();
    editor.setConfig(config);

    // webapp-ble-sync: "Webapp pulls bitmaps for icons already referenced by
    // a device's configuration" - so the editor shows accurate previews of
    // icons that already exist on-device, not just ones uploaded this
    // session.
    deviceIconIds = new Set();
    const iconIds = collectIconIds(config);
    let pulled = 0;
    for (const iconId of iconIds) {
      setStatus(
        `Pulling icons (${++pulled}/${iconIds.size})...`,
        "pending",
      );
      const bytes = await connection.downloadIcon(iconId);
      if (bytes) {
        editor.icons.set(iconId, {
          bytes,
          previewCanvas: rgb565ToCanvas(bytes, ICON_WIDTH, ICON_HEIGHT),
        });
        deviceIconIds.add(iconId);
      }
      // webapp-ble-sync: "A referenced icon that no longer exists on-device"
      // - leave it out of editor.icons entirely; the grid cell already falls
      // back to the slot's color when no cached bitmap exists for its icon.
    }
    editor.render();

    setStatus("Connected and up to date with the device.", "ok");
    pushBtn.disabled = false;
  } catch (err) {
    setStatus(`Connection failed: ${err.message}`, "error");
  }
});

pushBtn.addEventListener("click", async () => {
  if (!connection || !connection.isConnected) {
    setStatus("Not connected to a device.", "error");
    return;
  }

  // webapp-layer-editor: "Editor blocks pushing an invalid configuration".
  if (!isPushValid(config)) {
    setStatus(
      "Configuration has buttons pointing at layers that don't exist - fix those before pushing.",
      "error",
    );
    return;
  }

  try {
    setStatus("Checking device compatibility...", "pending");
    const compatible = await connection.isSchemaCompatible();
    if (!compatible) {
      const proceed = window.confirm(
        "This device reports a different config schema version than this webapp expects. Push anyway?",
      );
      if (!proceed) {
        setStatus("Push cancelled (schema version mismatch).", "error");
        return;
      }
    }

    // webapp-ble-sync: "Webapp uploads new icon bitmaps before pushing the
    // config that references them" - completes ALL such uploads before the
    // ConfigTransfer push itself, so the device is never left holding a
    // config that references an icon id it doesn't have.
    const iconIds = collectIconIds(config);
    for (const iconId of iconIds) {
      if (deviceIconIds.has(iconId)) continue;
      const icon = editor.icons.get(iconId);
      if (!icon) continue; // no local bytes to upload; nothing we can do

      setStatus(`Uploading icon "${iconId}"...`, "pending");
      const result = await connection.uploadIcon(iconId, icon.bytes);
      if (result !== "uploaded") {
        setStatus(
          `Icon upload failed for "${iconId}" (${result}) - push cancelled.`,
          "error",
        );
        return;
      }
      deviceIconIds.add(iconId);
    }

    setStatus("Pushing configuration...", "pending");
    const result = await connection.pushConfig(config);

    // webapp-ble-sync: "Webapp confirms the outcome of a push" - chunk
    // delivery being acked isn't the same as the config being applied.
    if (result.lastApplyResult === "applied") {
      setStatus("Configuration applied successfully.", "ok");
    } else {
      setStatus(
        `Device rejected the push: ${result.lastApplyResult}`,
        "error",
      );
    }
  } catch (err) {
    setStatus(`Push failed: ${err.message}`, "error");
  }
});

// webapp-config-backup: "Editor exports the current configuration and its
// icons to a backup file" - works with or without a device connected, since
// it only serializes whatever is currently loaded in the editor.
downloadBackupBtn.addEventListener("click", () => {
  const backup = serializeBackup(config, editor.icons);
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "streamdeck-backup.json";
  link.click();
  URL.revokeObjectURL(url);
});

// webapp-config-backup: "Editor imports a backup file back into its state".
restoreBackupInput.addEventListener("change", async () => {
  const file = restoreBackupInput.files[0];
  restoreBackupInput.value = ""; // allow re-selecting the same file again later
  if (!file) return;

  let restored;
  try {
    const text = await file.text();
    restored = deserializeBackup(text);
  } catch (err) {
    // webapp-config-backup: "Import surfaces a clear error for an
    // unreadable backup file" - the currently-loaded config/icons are left
    // untouched since nothing below this point has run yet.
    setStatus(`Restore failed: ${err.message}`, "error");
    return;
  }

  // webapp-config-backup: "Import surfaces a schema version mismatch
  // instead of silently applying it" - mirrors the existing device-push
  // schema-mismatch confirmation.
  if (restored.config.schemaVersion !== SCHEMA_VERSION) {
    const proceed = window.confirm(
      "This backup reports a different config schema version than this webapp expects. Restore anyway?",
    );
    if (!proceed) {
      setStatus("Restore cancelled (schema version mismatch).", "error");
      return;
    }
  }

  // Populate icons before setConfig() so its one internal render() already
  // shows the restored icon previews, instead of rendering once without
  // them and needing a second render() right after.
  for (const [iconId, bytes] of restored.icons) {
    editor.icons.set(iconId, {
      bytes,
      previewCanvas: rgb565ToCanvas(bytes, ICON_WIDTH, ICON_HEIGHT),
    });
  }

  // `Editor.setConfig()` alone does not update this outer `config` binding -
  // pushBtn's handler reads this variable, not anything internal to
  // `Editor` - so both must be reassigned, mirroring the connect handler's
  // pull (`config = await connection.pullConfig(); editor.setConfig(config);`).
  config = restored.config;
  editor.setConfig(config);

  if (restored.skippedIconIds.length > 0) {
    setStatus(
      `Restored backup (skipped invalid icon(s): ${restored.skippedIconIds.join(", ")}). Not yet pushed to a device.`,
      "error",
    );
  } else {
    setStatus("Restored backup. Not yet pushed to a device.", "ok");
  }
});
