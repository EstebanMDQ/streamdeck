## Why

There is no software yet for the CYD-based macro pad: the repo is an empty OpenSpec
scaffold. This change establishes the first working version - a 6-button touchscreen
device that acts as a BLE keyboard, configurable from a browser-based webapp - so the
project has a concrete, buildable target instead of just hardware and an idea.

## What Changes

- New ESP32 firmware for the ESP32-2432S028R CYD board: renders a 6-button grid on the
  ILI9341 display, reads touch input via XPT2046, and pairs as a BLE HID
  keyboard/media-control device.
- Buttons and layers are data-driven: a button is either a leaf action (sends a
  keystroke or media key) or a link into a nested layer of up to 6 more buttons.
  Layer navigation happens entirely on-device.
- Config (the full set of layers/buttons) is persisted on-device in LittleFS so the
  device works standalone after being configured once.
- A custom BLE GATT service exposes the config for chunked read/write so it can be
  edited without a wired connection or companion app.
- A new static webapp (deployable to GitHub Pages) provides a visual editor for
  layers/buttons and uses the Web Bluetooth API to push/pull config directly to/from
  the device.
- Firmware is packaged as a standalone `.bin` buildable via PlatformIO CI, suitable
  for installation through the bmorcelli Launcher (WebUI, SD card, or catalog).

## Capabilities

### New Capabilities
- `macropad-layer-model`: the on-device data model for buttons and layers - a 6-button
  grid per layer, nested layers, and the distinction between leaf actions and
  layer-link buttons.
- `macropad-display-ui`: rendering the current layer's 6 buttons (label + color) on
  the ILI9341 display and mapping XPT2046 touch coordinates to button presses,
  including navigating into/out of layers.
- `macropad-ble-hid`: pairing as a BLE HID keyboard/media-control device and emitting
  the configured keystroke or media-key combo when a leaf button is pressed.
- `macropad-ble-config-protocol`: a custom BLE GATT service for reading and writing
  the full layer/button configuration in chunks, independent of the HID profile.
- `macropad-config-storage`: persisting the layer/button configuration to LittleFS,
  loading it on boot, and falling back to a sane default configuration when none
  exists yet.
- `webapp-layer-editor`: a static, GitHub Pages-hosted UI for creating/editing layers
  and buttons (label, color, action type, and either a keystroke/media-key or a link
  to another layer).
- `webapp-ble-sync`: connecting the webapp to a paired device over Web Bluetooth and
  pushing/pulling configuration through the `macropad-ble-config-protocol` service.
- `firmware-release-packaging`: building the firmware into a standalone `.bin` via CI
  and publishing it in a form installable through the bmorcelli Launcher.

### Modified Capabilities
(none - this is the first change in the project)

## Impact

- New firmware project (PlatformIO + Arduino framework) targeting the ESP32-2432S028R
  board specifically; introduces dependencies on TFT_eSPI, an XPT2046 touch driver, an
  ESP32 BLE HID library, and LittleFS.
- New static webapp project (HTML/JS, Web Bluetooth API), with a GitHub Pages
  deployment workflow.
- New CI workflow to build and publish firmware release binaries.
- No existing code, specs, or systems are affected since this is the project's first
  change.
