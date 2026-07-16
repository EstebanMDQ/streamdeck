## Why

v1 buttons are label + background color only. An icon is far more scannable at a
glance than a short text label on a small screen, and it's the single most-requested
capability deferred from the MVP (recorded as a phase-2 candidate in
`openspec/config.yaml`). The approach was already sketched during MVP planning: the
webapp converts an uploaded image client-side to a small fixed-size raw bitmap in the
exact pixel format the device expects, so firmware never needs a PNG/JPEG decoder -
it just blits raw bytes.

## What Changes

- A button slot may optionally reference an icon (by id) in addition to its existing
  label and color. When an icon is set, the device renders it as the slot's
  background image instead of a flat color fill; the label is still drawn as an
  overlay. Buttons without an icon behave exactly as before (label + color only) -
  this is purely additive.
- Icons are fixed at 64x64 pixels, stored on-device as raw RGB565 bitmaps
  (8192 bytes each) - no image decoding on the ESP32 at all.
- The webapp gains an "upload icon" control per slot: it loads the chosen image via
  the Canvas API, crops/resizes it to 64x64, converts it to RGB565 bytes, and
  computes a content-hash id for it (so identical images across buttons are stored
  once).
- A new BLE transfer path uploads/downloads icon bitmaps by id, separate from the
  existing config JSON transfer, so pushing a config that references icons already on
  the device doesn't require re-sending their bitmaps every time.
- On connect, the webapp also pulls the bitmap for any button that already has an
  icon set, so the editor shows accurate previews of existing icons.

## Capabilities

### New Capabilities
- `macropad-icon-assets`: on-device icon storage (save/load a fixed-size RGB565
  bitmap by id) and the BLE characteristics for uploading/downloading an icon's
  bitmap by id, independent of the main config JSON transfer.

### Modified Capabilities
- `macropad-layer-model`: a button slot gains an optional `icon` field (an icon id
  string) alongside the existing label/color/action fields.
- `macropad-display-ui`: rendering a slot with an icon set draws the icon bitmap as
  the slot's background instead of a flat color fill, falling back to the color fill
  if the referenced icon can't be loaded (e.g. never uploaded or corrupted).
- `webapp-layer-editor`: adds an icon upload control per slot, including image
  loading/cropping/resizing/RGB565 conversion and a live local preview.
- `webapp-ble-sync`: adds pushing an icon's bitmap after upload/edit, and pulling
  bitmaps for any icons already referenced by a device's current configuration.

## Impact

- Firmware: new icon storage functions in `src/storage/` (or a new
  `src/assets/IconStorage.*`), new characteristics on the existing config GATT
  service in `src/ble/ConfigService.cpp`, and icon-aware rendering in
  `src/display/DisplayManager.cpp`. Icon file format/size validation is pure logic
  and gets native unit test coverage the same way config validation does.
- Webapp: new image-handling code in `webapp/js/` (resize/crop/RGB565 conversion is
  pure-enough logic to unit test with a synthetic pixel buffer, without needing a
  real browser Canvas).
- Storage: each icon costs a fixed 8192 bytes of LittleFS space; no reference
  counting or garbage collection of orphaned icons in this change (see design.md's
  non-goals) - acceptable given the ~1.9MB LittleFS partition can hold hundreds of
  icons.
- No changes to the existing config JSON schema's other fields, the chunked
  ConfigTransfer/ConfigDump protocol, or any BLE HID behavior.
