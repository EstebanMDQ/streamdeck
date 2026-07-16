## 1. Webapp: backup file format (pure logic)

- [x] 1.1 Implement `bytesToBase64`/`base64ToBytes` helpers in a new `webapp/js/backup.js`, chunked to avoid call-stack limits on larger inputs
- [x] 1.2 Implement `serializeBackup(config, icons)` -> a `{ backupFormatVersion, config, icons }` object, encoding each icon's bytes as base64. Filter `icons` down to `collectIconIds(config)` first (the caller passes the full `Editor.icons` Map, but only entries actually referenced by `config` are encoded) - `Editor.icons` accumulates unrelated entries across the whole session (every device connected to, every template applied) that have nothing to do with the config being exported
- [x] 1.3 Implement `deserializeBackup(json)` -> `{ config, icons: Map<id, Uint8Array>, skippedIconIds: string[] }`, validating overall shape (throwing a clear error if `json` isn't valid JSON or is missing required fields like `config`) and, per icon entry, that its decoded byte length is exactly `ICON_BYTES` - entries that fail only the per-icon size check are omitted from the returned map and their ids collected in `skippedIconIds` instead of throwing
- [x] 1.4 Add unit tests: a config+icons round-trips through serialize -> deserialize unchanged; serialize only includes icons referenced by the config, dropping unrelated entries from the input icons map; a wrong-length icon entry is dropped and reported in `skippedIconIds` while the rest of the backup still loads; malformed/missing-field JSON throws a clear error rather than returning a partial object

## 2. Webapp: export UI

- [x] 2.1 Add a "Download backup" control that calls `serializeBackup(config, editor.icons)` and triggers a browser file download (Blob + object URL + a synthetic `<a download>` click, calling `URL.revokeObjectURL()` once the download has been triggered), independent of whether a device is connected
- [ ] 2.2 Verify manually: exporting while connected to a device produces a file containing the current configuration and the bitmap bytes for every icon it references (and nothing else, even if the editor has unrelated icons cached from earlier in the session)

## 3. Webapp: import UI

- [x] 3.1 Add a "Restore backup" file input wired to `deserializeBackup`, rebuilding a preview canvas for each accepted icon via `icon.js`'s `rgb565ToCanvas`
- [x] 3.2 Wire the restored configuration and icons into app state: reassign `app.js`'s own module-level `config` binding (not just call `Editor.setConfig()`) and populate `Editor.icons`, mirroring the exact two-step pattern the connect handler already uses for a BLE pull (`config = ...; editor.setConfig(config);`) - `Editor.setConfig()` alone does not update `app.js`'s `config`, and `pushBtn`'s handler reads that outer binding, not anything internal to `Editor`
- [x] 3.3 If any icon entries were skipped (per `skippedIconIds`), tell the user which icon ids were skipped rather than failing silently
- [x] 3.4 If the restored configuration's schema version doesn't match the webapp's current version, warn the user and ask for confirmation before loading it - mirroring the existing device-push schema-mismatch confirmation
- [x] 3.5 If `deserializeBackup` throws (invalid JSON or missing required fields), catch it and show the user a clear error, leaving the currently-loaded configuration and icons untouched
- [x] 3.6 Update the status line to reflect that a restore just happened and hasn't been pushed to the connected device yet (if one is connected), since the editor's state no longer necessarily matches what that device actually has until the next push
- [ ] 3.7 Verify manually: restoring a backup with no device connected shows the correct layers, buttons, and icon previews

## 4. End-to-end hardware verification

- [ ] 4.1 Verify on real hardware: export a backup from a device with a non-trivial configuration (multiple layers, at least one icon button), restore that backup in a fresh browser session, push it to a different (or freshly-erased) device, and confirm the layout and icons match after the push

## 5. Documentation

- [x] 5.1 Update the README to document backup export/import and how to use it to move a configuration onto new hardware, distinguishing it from the SD-card mirror (`add-sd-config-backup`), which protects a single device's own storage rather than moving a config elsewhere
