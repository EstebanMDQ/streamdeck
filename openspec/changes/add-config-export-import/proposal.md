## Why

The only backup path that exists today (`add-sd-config-backup`) protects a single
physical device against its own internal storage getting corrupted or wiped - it
mirrors config to an SD card that stays in that same device. It does nothing for
the much more common real-world need: getting a working layout onto a *different*
piece of hardware - a replacement board after one dies, a second macro pad, or just
reinstalling from scratch after a bmorcelli Launcher reflash wipes both LittleFS and
whatever's in the SD slot. The webapp already holds everything needed for this (the
full config plus every icon bitmap it knows about) in memory the moment you connect
to a device - there's just no way to get it out to a file today, or back in later.

## What Changes

- The webapp gains a **Download backup** action that packages the current
  configuration (all layers and buttons) together with every icon bitmap currently
  known to the editor into a single JSON file, which the browser downloads locally.
- The webapp gains a **Restore backup** action that loads such a file back into the
  editor - layers, buttons, and icon previews all reappear exactly as backed up -
  without needing any device connected to do this.
- Pushing a restored backup to a device (new, blank, or the original one) needs no
  new BLE work at all: `webapp-ble-sync`'s existing icon-upload-before-config-push
  logic already re-uploads any icon the connected device doesn't yet have, and a
  brand-new device's known-icon set starts empty, so restoring onto new hardware
  "just works" through the push flow that already exists.
- Purely a webapp feature: no firmware changes, no new BLE characteristics, no
  change to the wire format used to talk to a device.

## Capabilities

### New Capabilities
- `webapp-config-backup`: exporting the current configuration and its icon bitmaps
  to a single downloadable backup file, and importing that file back into the
  editor's in-memory state (config + icon cache), independent of any device
  connection.

### Modified Capabilities
(none - this reuses `webapp-ble-sync`'s existing icon-upload-before-push behavior
unmodified; restoring a backup just means the editor's config/icons state came from
a file instead of a live pull, which that flow already can't tell apart from a
normal edit)

## Impact

- New `webapp/js/backup.js`: pure-logic serialization to/from the backup JSON
  format (including base64 encode/decode of icon bytes), unit-testable the same way
  `icon.js`'s conversion logic is.
- `webapp/js/editor.js` / `webapp/js/app.js`: a "Download backup" control that
  serializes `config` + `editor.icons`, and a "Restore backup" file input that
  deserializes into the same shapes and calls `editor.setConfig()`.
- No firmware changes (`src/`), no changes to `src/ble/ConfigService.cpp` or the BLE
  wire protocol, no changes to `lib/macropad_config` or `lib/macropad_icon`.
- Storage/size: a backup file is JSON text, dominated by base64-encoded icon bytes
  (~11KB of text per 8192-byte icon) - trivially small for local file
  download/upload, no server involved, no practical size ceiling for this use case.
