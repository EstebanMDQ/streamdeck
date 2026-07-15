## ADDED Requirements

### Requirement: Webapp connects to a device via Web Bluetooth
The webapp SHALL let a user initiate a Web Bluetooth connection scoped to the
device's config service UUID, prompting the browser's device chooser.

#### Scenario: User connects to a nearby device
- **WHEN** a user clicks "Connect" and selects their device from the browser's Bluetooth device chooser
- **THEN** the webapp establishes a GATT connection to that device's config service

### Requirement: Webapp pulls the current configuration before editing
Upon connecting, the webapp SHALL read the device's current configuration via the
`ConfigDump` characteristic and load it into the editor before the user makes changes.

#### Scenario: Configuration loads after connecting
- **WHEN** a Web Bluetooth connection to a device succeeds
- **THEN** the editor is populated with that device's current layers and buttons, read via `ConfigDump`

### Requirement: Webapp pushes edited configuration in chunks
When the user pushes their changes, the webapp SHALL serialize the configuration to
JSON and write it to the `ConfigTransfer` characteristic in one or more
length/offset-framed chunks sized within the negotiated BLE MTU.

#### Scenario: Pushing a configuration that fits in one chunk
- **WHEN** the user pushes a configuration whose serialized size fits within one write
- **THEN** the webapp sends it as a single framed `ConfigTransfer` write

#### Scenario: Pushing a configuration larger than one chunk
- **WHEN** the user pushes a configuration whose serialized size exceeds one write's capacity
- **THEN** the webapp splits it into multiple framed `ConfigTransfer` writes with increasing offsets

### Requirement: Webapp checks schema compatibility before pushing
Before pushing a configuration, the webapp SHALL read `ConfigStatus` and warn the
user instead of pushing if the device's supported `schemaVersion` does not match the
configuration being sent.

#### Scenario: Schema version mismatch
- **WHEN** the device's reported `schemaVersion` differs from the version the webapp is about to send
- **THEN** the webapp warns the user and does not push until the user acknowledges or the mismatch is resolved

### Requirement: Webapp confirms the outcome of a push
After completing a `ConfigTransfer` write (all chunks acknowledged), the webapp SHALL
read or subscribe to `ConfigStatus` and report the actual `lastApplyResult` to the
user, rather than treating acknowledged chunk delivery as confirmation that the
configuration was applied.

#### Scenario: Push is applied successfully
- **WHEN** all chunks of a push are acknowledged and `ConfigStatus.lastApplyResult` subsequently reports `applied`
- **THEN** the webapp shows the user a success confirmation

#### Scenario: Push is rejected after being fully sent
- **WHEN** all chunks of a push are acknowledged but `ConfigStatus.lastApplyResult` subsequently reports a rejection reason (`rejected_invalid_json`, `rejected_schema_version`, or `rejected_structure`)
- **THEN** the webapp shows the user an error identifying that the device did not apply the change, distinguishing the reason where possible

### Requirement: Webapp detects unsupported browsers
The webapp SHALL detect when the Web Bluetooth API is unavailable and show a clear
message explaining that a Chromium-based browser is required, instead of failing
silently when the user clicks "Connect".

#### Scenario: Opening the webapp in an unsupported browser
- **WHEN** a user opens the webapp in a browser without `navigator.bluetooth` support
- **THEN** the webapp displays a message that a Chromium-based browser (e.g. Chrome or Edge) is required
