## 1. Project setup

- [x] 1.1 Create the PlatformIO firmware project targeting the ESP32-2432S028R board (env, framework = arduino, pin map)
- [x] 1.2 Add firmware dependencies: TFT_eSPI (configured for ILI9341), XPT2046 touch driver, an ESP32 BLE HID library, ArduinoJson, LittleFS
- [x] 1.3 Create the static webapp project skeleton (plain HTML/CSS/JS, no build step) and a GitHub Pages deployment workflow
- [x] 1.4 Set up a PlatformIO native/Unity test environment for firmware unit tests (runs on the build host, no ESP32 or BLE radio required)
- [x] 1.5 Set up a lightweight JS test runner for the webapp's validation logic (runs in Node, no browser required)

## 2. Early bmorcelli Launcher install validation

- [ ] 2.1 Build a minimal "hello world" firmware (boots, prints/display something, no features yet) as an app-only `.bin`
- [ ] 2.2 Install that binary on a physical ESP32-2432S028R through bmorcelli Launcher's WebUI and confirm it boots correctly
- [ ] 2.3 Record the actual flash/partition constraints observed (max app size, FS space available) to guide later size decisions

<!-- Section 2 needs real ESP32-2432S028R hardware and a Launcher install -
     not doable in this environment. Everything below was implemented,
     compiles cleanly for the real ESP32 target (pio run -e esp32-2432S028R
     succeeds), and where noted is also unit-tested; hardware-dependent
     runtime verification remains open.

     Note found while compiling: the initial default.csv partition scheme
     left the firmware at 95.1% of its app partition (only ~64KB headroom).
     Since this project doesn't do its own OTA (bmorcelli Launcher handles
     installation), switched to no_ota.csv - a single ~2MB app partition
     instead of two ~1.3MB OTA slots - dropping usage to 59.4% with ~850KB
     of real headroom for growth. See platformio.ini. -->

## 3. Firmware: layer/button data model and storage

- [x] 3.1 Implement the in-memory layer/button model per `macropad-layer-model` (root layer, six slots, key/media/layer action types)
- [x] 3.2 Implement a built-in default configuration used when no config file exists yet
- [x] 3.3 Implement LittleFS load/save of the config JSON, including the atomic temp-file-then-rename write pattern
- [x] 3.4 Implement config validation (JSON parse + schemaVersion check + structural checks: six slots per layer, valid action types, valid media-key vocabulary) with fallback to default on failure
- [ ] 3.5 Verify: power-cycle the device mid-write (or simulate) and confirm the previous config is never corrupted
- [x] 3.6 Add native unit tests for config validation: valid config accepted, malformed JSON rejected, unsupported schemaVersion rejected, and each structural violation (wrong slot count, unknown action type, invalid media key) rejected

## 4. Firmware: display and touch UI

- [x] 4.1 Render the active layer's six button slots (label + background color), leaving empty slots blank
- [x] 4.2 Implement touch-to-slot-index mapping for the display's resolution/orientation
- [x] 4.3 Implement navigation into a layer when a `layer`-type button is pressed
- [x] 4.4 Implement the back affordance (hidden on root layer, shown otherwise, navigates to parent layer)
- [x] 4.5 Implement brief visual feedback on any non-empty slot press, independent of whether the action was actually delivered
- [x] 4.6 Implement reset-to-root when an applied configuration no longer contains the currently displayed layer
- [ ] 4.7 Verify on-device: navigate a multi-level layer tree using only touch and confirm back returns to the correct parent each time

## 5. Firmware: BLE HID actions

- [x] 5.1 Advertise and pair the device as a BLE HID keyboard/consumer-control peripheral
- [x] 5.2 Emit the configured keyboard report when a `key`-type button is pressed
- [x] 5.3 Emit the configured consumer-control report when a `media`-type button is pressed
- [x] 5.4 Confirm `layer`-type button presses never emit a HID report
- [ ] 5.5 Verify against a real host (macOS/Windows/Linux) that key and media presses arrive correctly over BLE

## 6. Firmware: BLE config protocol

- [x] 6.1 Define the config service and its `ConfigTransfer` (write with response), `ConfigDump`, `ConfigStatus` (read + notify) characteristics
- [x] 6.2 Implement chunked write reassembly on `ConfigTransfer` (length/offset framing) feeding into config validation from task 3.4
- [x] 6.3 Implement single-in-flight-transfer handling: discard the partial buffer on disconnect, on a new transfer starting, or after ~15s of inter-chunk inactivity
- [x] 6.4 Implement chunked read/notify of the current config on `ConfigDump` using the same framing
- [x] 6.5 Implement `ConfigStatus` reporting firmware version, supported schemaVersion, and `lastApplyResult`, updating and notifying it once a transfer finishes validation
- [x] 6.6 Verify with a small test payload larger than one BLE MTU that multi-chunk transfer reassembles correctly in both directions (covered by native + webapp unit tests of the framing logic; not yet exercised over a real BLE radio - see 6.6 note below)
- [x] 6.7 Verify `lastApplyResult` reflects the correct outcome for an accepted push and for each rejection reason (invalid JSON, unsupported schema, structural mismatch) (covered by native unit tests of `parseAndValidate`, which `lastApplyResult` maps 1:1 from; not yet exercised over a real BLE push)
- [x] 6.8 Add native unit tests for the chunk-reassembly buffer: in-order multi-chunk reassembly, a new transfer discarding a stale partial buffer, and inactivity-timeout discard

## 7. Webapp: layer editor

- [x] 7.1 Build the layer list/selector and the six-slot grid view for a selected layer
- [x] 7.2 Implement editing a slot's label, color, and action type (key/media/layer)
- [x] 7.3 Implement creating new layers and selecting them as `layer`-action targets
- [x] 7.4 Implement clearing a slot back to empty
- [x] 7.5 Implement deleting a non-root layer, blocking the deletion (with an error naming the referencing button(s)) if any button still targets it
- [x] 7.6 Implement pre-push validation (e.g. every `layer` action's target exists) with a clear error instead of allowing an invalid push
- [x] 7.7 Add JS unit tests for the editor's validation logic: target-exists check for pre-push validation, and delete-blocked-when-referenced check for layer deletion

## 8. Webapp: BLE sync

- [x] 8.1 Implement Web Bluetooth connect flow scoped to the config service UUID
- [x] 8.2 Implement pulling the current config via `ConfigDump` on connect and loading it into the editor
- [x] 8.3 Implement pushing edited config via chunked `ConfigTransfer` writes
- [x] 8.4 Implement `ConfigStatus` schema-version check before push, warning on mismatch
- [x] 8.5 Implement post-push confirmation: after all chunks are acknowledged, read/subscribe to `ConfigStatus.lastApplyResult` and surface success or the specific rejection reason to the user
- [x] 8.6 Implement the unsupported-browser message when `navigator.bluetooth` is unavailable
- [ ] 8.7 Verify end-to-end: edit a layer tree in the webapp, push to a real device, and confirm the device's display and HID behavior match what was configured

## 9. Firmware release packaging

- [x] 9.1 Add a CI job that runs the firmware native unit tests and webapp JS unit tests on every push
- [x] 9.2 Add a CI workflow that builds the ESP32-2432S028R firmware as an app-only `.bin` from a clean checkout
- [x] 9.3 Wire the workflow to publish the `.bin` as a release artifact on version tags
- [ ] 9.4 Re-verify a published release build installs and boots via bmorcelli Launcher (repeat of task 2.2 against the real feature-complete build)

## 10. Documentation

- [x] 10.1 Write a short README covering: flashing via bmorcelli Launcher, connecting the webapp, and editing layers
- [x] 10.2 Document binding emitted keystrokes/media keys to real OS actions (example recipes for Hammerspoon, AutoHotkey, PowerToys, Shortcuts)
