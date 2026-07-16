## ADDED Requirements

### Requirement: A newly applied configuration is mirrored to an SD card as a best-effort backup
Whenever a configuration is validated and persisted to LittleFS, the firmware SHALL
also attempt to write the same JSON to a file on an SD card if one is inserted. This
backup write SHALL be best-effort: a missing card, or any failure while mounting,
writing, or unmounting the card, SHALL NOT prevent the configuration from being
applied and persisted internally. The write SHALL be atomic (temp file then rename),
the same pattern already used for the internal LittleFS write, so a power loss
mid-write cannot leave a corrupt backup file.

#### Scenario: SD card present when a config is applied
- **WHEN** a valid configuration is applied and persisted to LittleFS, and an SD card is inserted
- **THEN** the same configuration is also written to the SD card

#### Scenario: No SD card inserted
- **WHEN** a valid configuration is applied and no SD card is inserted
- **THEN** the configuration is still applied and persisted to LittleFS, and no backup write blocks or fails that process

#### Scenario: SD card backup write fails
- **WHEN** a valid configuration is applied and the SD card backup write fails (e.g. card full, mount failure, or a write error)
- **THEN** the configuration is still applied and persisted to LittleFS, and the failure does not block boot or future operation

#### Scenario: Power loss during the SD write does not leave a corrupt backup
- **WHEN** power is lost while the SD backup is being written to its temporary filename
- **THEN** the previously persisted SD backup file (if any) remains intact and loadable, since the incomplete temp file is never renamed over it

## MODIFIED Requirements

### Requirement: Missing or invalid configuration falls back to a default
On boot, the firmware SHALL attempt to load configuration in this order: (1) the
internal LittleFS configuration, if present and valid; (2) otherwise the SD card
backup, if present, no larger than a fixed size cap, and valid, in which case it
SHALL also be re-persisted to LittleFS; (3) otherwise a built-in hardcoded default
configuration. Validity for both internal and SD sources means the same syntactic and
structural checks used for a BLE-pushed configuration (JSON parses, `schemaVersion`
supported, structural checks pass). The SD backup file SHALL NOT be read into memory
for validation if it exceeds the fixed size cap - an oversized file is treated as
invalid without attempting to allocate a buffer for it, since the SD backup is
explicitly a source that may contain a foreign or corrupted file.

#### Scenario: Internal configuration is present and valid
- **WHEN** the device boots and the internal LittleFS configuration file exists and is valid
- **THEN** the device loads and displays that configuration without consulting the SD card

#### Scenario: Internal configuration missing or invalid, SD backup available
- **WHEN** the device boots and the internal LittleFS configuration is missing, unparsable, or fails structural/schema validation, and a valid backup within the size cap exists on an inserted SD card
- **THEN** the device loads and displays the SD backup, and also re-persists it to LittleFS

#### Scenario: Internal configuration and SD backup both missing or invalid
- **WHEN** the device boots and there is no valid internal configuration and no valid SD card backup (missing card, missing file, or a file that fails validation)
- **THEN** the device loads its built-in default configuration instead of failing to boot

#### Scenario: SD backup file exceeds the size cap
- **WHEN** the device boots with no valid internal configuration, and the SD card has a file at the backup path larger than the fixed size cap
- **THEN** the device treats it as invalid without reading its full contents into memory, and falls through to the SD-backup-invalid path (the hardcoded default, since the SD source is unusable)
