## 1. Firmware: icon storage and data model

- [x] 1.1 Implement icon file save/load by id in a new `src/assets/IconStorage.*` (or alongside `ConfigStorage`), validating exactly 8192 bytes before saving - the size check itself lives in a new pure-logic `lib/macropad_icon` so it's natively testable, matching the `macropad_config`/`macropad_transfer` pattern
- [x] 1.2 Add native unit tests for the size-validation logic (accept exactly 8192 bytes, reject anything else) - pure logic, no hardware needed
- [x] 1.3 Extend the button/slot struct and JSON (de)serialization in `lib/macropad_config` to read/write the optional `icon` field

## 2. Early hardware verification: RGB565 byte order (firmware-only, standalone)

This section is a throwaway test harness independent of sections 3/4 - it calls
`IconStorage::save()` and `pushImage()` directly with a hand-constructed byte buffer,
NOT through the real `IconUpload` BLE characteristic (section 3) or the real
`DisplayManager` icon-rendering path (section 4), neither of which exist yet at this
point. The goal is only to pin down the firmware's own expected byte order early.

- [ ] 2.1 Hand-construct a known-color 64x64 RGB565 byte buffer (e.g. solid red) in test/throwaway firmware code, save it via `IconStorage`, and render it via a direct `pushImage()` call
- [ ] 2.2 Verify on-device that the rendered color matches what was intended, not a channel-swapped variant - record the confirmed byte order (e.g. which byte is high/low, RGB vs BGR ordering) for task 5.2 to match

## 3. Firmware: BLE icon transfer protocol

- [x] 3.1 Add `IconTransferId`, `IconUpload` (write with response, chunked), `IconDownload` (read + notify, chunked), and `IconStatus` (read + notify) characteristics to the existing config GATT service
- [x] 3.2 Wire `IconUpload`'s chunk reassembly (reusing `macropad::ChunkReassembler`) to `IconStorage`'s size-validated save, updating `IconStatus` accordingly
- [x] 3.3 Implement single-in-flight-transfer handling for `IconUpload`: discard the partial buffer when `IconTransferId` changes mid-upload, on disconnect, and silently discard chunks received with no `IconTransferId` ever set
- [x] 3.4 Wire `IconDownload` to stream a stored icon's bytes in framed chunks, or a zero-length response if not found, updating `IconStatus` to `downloaded` or `not_found` accordingly
- [ ] 3.5 Verify on-device: upload an icon, then download it back, and confirm the bytes match
- [x] 3.6 Add native unit tests for the single-in-flight-transfer handling (reusing the same test patterns as `ChunkReassembler`'s existing tests: new-transfer-discards-stale-buffer, chunk-with-no-prior-transfer-rejected) - IconUpload reuses the exact same `ChunkReassembler` class already covered by `test_chunk_reassembler`, including its `reset()` behavior that `IconTransferIdCallbacks` relies on; no redundant second test suite needed for the reassembly logic itself

## 4. Firmware: icon-aware rendering

- [x] 4.1 Update `DisplayManager` to load and `pushImage()` a slot's icon when its `icon` field is set and the file loads successfully
- [x] 4.2 Implement fallback to the color fill when a slot's icon is missing or the wrong size
- [x] 4.3 Keep the label overlaid on icon buttons (small text near the bottom of the slot)
- [ ] 4.4 Verify on-device: a mix of icon and non-icon buttons in the same layer render correctly, and a button referencing a nonexistent icon id falls back to its color

## 5. Webapp: image conversion pipeline

- [x] 5.1 Implement image load + cover-crop/resize to 64x64 via the Canvas API
- [x] 5.2 Implement RGBA-to-RGB565 pixel conversion, matching the byte order recorded in task 2.2
- [x] 5.3 Implement content-hash icon id computation (e.g. via `crypto.subtle.digest`) over the converted bitmap bytes
- [x] 5.4 Add JS unit tests for the RGBA-to-RGB565 conversion against a synthetic pixel buffer (no real browser Canvas needed) and for icon-id stability (same input bytes -> same id)
- [ ] 5.5 Verify on real hardware, before building any editor UI on top of it: convert one known-color test image with the actual webapp conversion code (task 5.2, not the section-2 hand-built buffer), upload it via a temporary/manual test path, and confirm it renders with the correct color - this is what actually validates the webapp matches the firmware's byte order, since task 2.2 alone only proves the firmware's own convention

## 6. Webapp: layer editor icon UI

- [x] 6.1 Add an "upload icon" control per slot, wired to the conversion pipeline
- [x] 6.2 Show a live local preview of the converted bitmap immediately after upload
- [x] 6.3 Add a "clear icon" control that removes only the `icon` field, leaving label/color/action untouched

## 7. Webapp: BLE icon sync

- [x] 7.1 Implement uploading new/changed icon bitmaps via `IconTransferId` + chunked `IconUpload`, confirming each via `IconStatus`, completing ALL such uploads before sending the `ConfigTransfer` push that references them
- [x] 7.2 Implement pulling bitmaps for every distinct icon id referenced by a device's configuration after connecting, via `IconTransferId` + `IconDownload`
- [x] 7.3 Handle a zero-length `IconDownload` response (icon not found) by falling back to the color preview instead of a broken image
- [ ] 7.4 Verify end-to-end: configure an icon button in the webapp, push it, reconnect fresh, and confirm the editor shows the correct icon preview pulled back from the device

## 8. Documentation

- [x] 8.1 Update the README to mention icon buttons, the 64x64 size constraint, and that icons are recovery-scoped (no orphan cleanup) per design.md's non-goals
