## Why

Whether reinstalling firmware through bmorcelli Launcher preserves or wipes the
device's LittleFS config partition has never been confirmed - Launcher's partition
manager operates in terms of per-app flash regions, and only a fresh install has
been tested so far. Rather than leave that as an open risk, mirror the active
configuration to the board's microSD slot (already present on the hardware, unused
today) as a backup a reflash can't touch, and restore from it automatically if
internal storage ever comes back missing or invalid.

## What Changes

- Every time a configuration is validated and persisted to LittleFS (via a BLE push),
  the firmware also writes the same JSON to an SD card, if one is inserted. This is
  best-effort: a missing card, a full card, or a write failure never blocks the
  config from being applied and persisted internally.
- Boot recovery becomes three-tier: internal LittleFS config if present and valid,
  else a valid SD card backup (re-persisted to LittleFS if used), else the built-in
  hardcoded default.
- The SD card copy is validated with the same structural/schema checks as a BLE push
  before being trusted - it is a recovery mechanism, not a user-editable alternate
  config source in this change.

## Capabilities

### New Capabilities
(none - this extends the existing config storage capability)

### Modified Capabilities
- `macropad-config-storage`: adds SD card backup-on-apply and three-tier boot
  recovery (internal flash -> SD backup -> hardcoded default), on top of the existing
  internal-LittleFS-only persistence.

## Impact

- Firmware: `src/storage/ConfigStorage.*` gains SD card read/write logic; requires an
  SD/SPI library dependency (the ESP32 Arduino core's built-in `SD`/`SD_MMC` support,
  wired to the CYD's microSD slot) and adds it to `platformio.ini`.
- No webapp changes - this is entirely on-device behavior, invisible to the config
  protocol/webapp.
- No breaking changes to the existing BLE config protocol or on-disk config format;
  the SD file uses the same JSON schema as the internal one.
