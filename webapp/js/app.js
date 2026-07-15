import { createEmptyConfig } from "./model.js";
import { isPushValid } from "./validation.js";
import { Editor } from "./editor.js";
import { isBluetoothSupported, DeviceConnection } from "./ble-sync.js";

const editorRoot = document.getElementById("editor-root");
const connectBtn = document.getElementById("connect-btn");
const pushBtn = document.getElementById("push-btn");
const statusEl = document.getElementById("status");
const unsupportedBanner = document.getElementById("unsupported-banner");

let config = createEmptyConfig();
let connection = null;

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
