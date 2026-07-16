## Context

Builds on `add-macropad-mvp`'s layer/button model, BLE config protocol, and display
rendering (all now archived as baseline specs under `openspec/specs/`). The MVP
deliberately scoped icons out; this change adds them following the approach already
sketched in `config.yaml` during that planning: client-side conversion to a raw
device-native pixel format, no on-device image decoding.

## Goals / Non-Goals

**Goals:**
- Buttons can show a small image instead of (in addition to) a flat color, with zero
  new firmware image-decoding code or dependencies.
- Uploading one icon doesn't require re-uploading every other icon already on the
  device - icon bitmaps transfer independently from the config JSON.
- Editing a device's config in the webapp shows accurate previews of icons it
  already has, not just ones just uploaded in the current session.

**Non-Goals:**
- Reference counting or garbage-collecting orphaned icon files when a button's icon
  changes or a button/layer is deleted. At a fixed 8192 bytes/icon and a ~1.9MB
  LittleFS partition, hundreds of icons fit; a stray unreferenced file occasionally
  is an acceptable trade-off against the complexity of tracking references. Revisit
  if real-world usage ever approaches that limit.
- Arbitrary icon dimensions, animated icons, or a built-in icon picker/library -
  every icon is a user-uploaded 64x64 image, full stop.
- Compressing stored/transferred icon bitmaps (e.g. RLE). Rejected for the same
  reason the config JSON itself isn't compressed: simplicity now, revisit only if
  storage or transfer time actually becomes a problem in practice.

## Decisions

### Fixed 64x64 RGB565 bitmaps, stored and transferred raw
64x64 at 2 bytes/pixel is exactly 8192 bytes - small enough that a few dozen icons
are a rounding error against the ~1.9MB LittleFS partition, and fits comfortably
within a button cell (roughly 100x104px per slot on the current 3x2 grid) without
upscaling artifacts. A fixed size means the device can validate an uploaded bitmap
with a single length check (reject anything that isn't exactly 8192 bytes) instead
of parsing image headers - consistent with "no image decoding on-device" being the
whole point.
- Alternative considered: store/transfer PNG or another compressed format and decode
  on-device. Rejected - reintroduces exactly the decoder dependency/flash cost this
  design exists to avoid.

### Icon bitmaps stored separately from the config JSON, transferred by id
Icons are NOT embedded in the config JSON (as e.g. base64) - that would bloat the
document ~33% per icon and force every config push to resend every icon's bytes even
when unchanged. Instead:
- On-device: each icon is its own file, `/icons/<iconId>.bin`, exactly 8192 bytes.
- In the config JSON: a button slot's optional `icon` field is just the id string
  (e.g. `"icon": "a3f9c21b"`), not bitmap data.
- Icon id is a content hash (e.g. truncated SHA-256, computed client-side via
  `crypto.subtle.digest`) of the resized RGB565 bytes, so uploading the same image
  for two different buttons stores and transfers it once.

### New BLE characteristics for icon transfer, reusing the existing chunk framing
Rather than invent a new wire format, icon upload/download reuses the exact
`[uint16 totalLength][uint16 offset][payload]` chunk framing and
`macropad::ChunkReassembler` already used by `ConfigTransfer`/`ConfigDump`
(`add-macropad-mvp`'s design). New characteristics on the same config GATT service:
- `IconTransferId` (write, small, not chunked): sets which icon id the next
  `IconUpload` write or `IconDownload` read applies to. Written once before starting
  a transfer.
- `IconUpload` (write with response, chunked): bitmap bytes for the id set via
  `IconTransferId`. On completion, the firmware validates the reassembled payload is
  exactly 8192 bytes before saving it to `/icons/<iconId>.bin`.
- `IconDownload` (read + notify, chunked): mirrors `ConfigDump` - subscribing and
  then reading streams the requested icon's bytes back in framed chunks. If no file
  exists for the id set via `IconTransferId`, it sends a zero-length response
  (webapp treats this as "not found" and knows to prompt a fresh upload rather than
  showing a broken preview).
- `IconStatus` (read + notify, small): reports the outcome of the last icon
  operation - `none | uploaded | rejected_wrong_size | downloaded | not_found` -
  mirroring `ConfigStatus.lastApplyResult`'s pattern so the webapp can confirm an
  upload actually landed instead of assuming success from chunk delivery alone.
- Alternative considered: prefix each `IconUpload` chunk's frame with the icon id
  instead of a separate `IconTransferId` characteristic. Rejected - would require a
  different, incompatible framing from `ConfigTransfer`'s, instead of reusing the
  exact same `ChunkReassembler` code path.

### Rendering: icon replaces the color fill, label still overlaid
When a slot's `icon` field is set, `DisplayManager` loads `/icons/<iconId>.bin` and
blits it via TFT_eSPI's `pushImage()` instead of `fillRect`-ing the configured color;
the label is still drawn on top (small text near the bottom of the slot) so icon
buttons remain identifiable by name, not just image. If the icon file is missing or
the wrong size (unreferenced upload, corrupted file), the slot falls back to
rendering its color fill instead - consistent with this codebase's existing pattern
of degrading gracefully rather than failing hard on a missing on-device resource
(e.g. `ConfigStorage::load()`'s fallback to a hardcoded default).

### Client-side image resize/crop/convert, done with the Canvas API
The webapp draws the source image onto an offscreen `<canvas>` at 64x64 (cover-crop
to fill the square, matching common icon-cropping UX), reads back the pixel buffer
via `getImageData()`, and converts each RGBA pixel to a 16-bit RGB565 value. This
logic (pixel format conversion) is pure enough to unit-test directly against a
synthetic `Uint8ClampedArray` input, without needing a real browser Canvas in the
test run - same pattern as the existing chunk-framing tests.

## Risks / Trade-offs

- **RGB565 byte order/endianness between the webapp's packed bytes and what
  TFT_eSPI's `pushImage()` expects is not yet verified against real hardware** -
  color-channel swaps or scrambled images are a common class of bug for exactly this
  kind of raw-bitmap-blit approach. Mitigate with an early hardware-verification task
  (push one known-color test icon and visually confirm correct colors) before
  building the rest of the feature on an unverified assumption.
- **No orphaned-icon cleanup** (see Non-Goals) → mitigate by documenting the
  ~hundreds-of-icons headroom clearly, and revisit only if real usage approaches it.
- **Icon upload adds real BLE transfer time** (8192 bytes at ~180 bytes/chunk is
  ~46 round trips) → acceptable for an infrequent editing operation, but the webapp
  should show upload progress rather than an unresponsive-looking UI during it.
- **Two independent transfer paths (config JSON vs. icon bitmaps) can drift out of
  sync** if, e.g., a config push references an icon id that was never actually
  uploaded (or upload failed) → mitigated by `macropad-display-ui`'s fallback to the
  color fill on a missing/invalid icon file, so a sync gap degrades gracefully
  instead of showing a broken or blank button.
