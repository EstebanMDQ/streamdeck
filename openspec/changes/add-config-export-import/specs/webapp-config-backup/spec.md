## ADDED Requirements

### Requirement: Editor exports the current configuration and its icons to a backup file
The webapp SHALL allow the user to download the currently-loaded configuration,
together with the bitmap bytes for every icon actually referenced by that
configuration, as a single JSON backup file. This SHALL work whether or not a
device is currently connected. Icons the editor happens to know about but that
the current configuration doesn't reference SHALL NOT be included.

#### Scenario: Downloading a backup while editing
- **WHEN** a user clicks the download-backup control
- **THEN** the browser downloads a JSON file containing the current configuration and the bitmap bytes for every icon referenced by that configuration

#### Scenario: Downloading a backup with no device connected
- **WHEN** a user clicks the download-backup control while no device is connected
- **THEN** the webapp still produces a backup file from whatever configuration is currently loaded in the editor

### Requirement: Editor imports a backup file back into its state
The webapp SHALL allow the user to choose a previously-exported backup file and
load its configuration and icon bitmaps into the editor - reproducing the same
layers, buttons, and icon previews the backup was made from - without requiring
any device connection to do so.

#### Scenario: Restoring a backup
- **WHEN** a user chooses a valid backup file via the restore-backup control
- **THEN** the editor shows the backed-up layers and buttons, with icon previews for every icon bitmap the backup contained

#### Scenario: Restoring a backup with no device connected
- **WHEN** a user restores a backup file while no device is connected
- **THEN** the editor loads the configuration and icon previews normally, without attempting any BLE operation

### Requirement: A restored configuration can be pushed to any connected device
Pushing a restored configuration to a connected device - including one that has
never seen any of its icons before - SHALL work through the same
upload-before-push flow used for any other edit, requiring no special handling for
configurations that originated from a backup file.

#### Scenario: Pushing a restored backup to a brand-new device
- **WHEN** a user restores a backup and then pushes it to a device that has none of the backup's icons yet
- **THEN** the webapp uploads each of the backup's icon bitmaps to that device before sending the configuration, exactly as it would for any newly-set icon

### Requirement: Import validates icon bytes before accepting them
For each icon entry in a backup file, the webapp SHALL decode its bytes and verify
they are exactly the expected icon size before adding it to the editor's icon
cache. An icon entry that fails this check SHALL be dropped, with the user told
which icon id was skipped, rather than silently accepted.

#### Scenario: An icon entry with the wrong byte length is skipped
- **WHEN** a backup file's `icons` map contains an entry whose decoded byte length is not the expected icon size
- **THEN** the webapp skips that icon entry, tells the user which icon id was skipped, and still loads the rest of the backup normally

### Requirement: Import surfaces a schema version mismatch instead of silently applying it
If a backup file's configuration reports a different schema version than the
webapp currently expects, the webapp SHALL warn the user and let them choose
whether to proceed, rather than silently loading a configuration in an
unexpected shape.

#### Scenario: Restoring a backup with a mismatched schema version
- **WHEN** a user restores a backup file whose configuration reports a schema version different from the webapp's current version
- **THEN** the webapp warns the user about the mismatch and asks for confirmation before loading it into the editor

### Requirement: Import surfaces a clear error for an unreadable backup file
If a chosen file isn't a valid backup at all - invalid JSON, or missing required
fields such as `config` - the webapp SHALL show the user a clear error and SHALL
NOT change whatever configuration and icons are currently loaded in the editor.

#### Scenario: Choosing a file that isn't a valid backup
- **WHEN** a user chooses a file for restore that is not valid JSON, or is valid JSON missing required backup fields
- **THEN** the webapp shows a clear error describing the problem and leaves the editor's current configuration and icons unchanged
