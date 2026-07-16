## ADDED Requirements

### Requirement: Webapp uploads new icon bitmaps before pushing the config that references them
When the user pushes a configuration containing one or more slots whose icon the
device doesn't already have, the webapp SHALL upload each such icon's bitmap via
`IconTransferId` and chunked `IconUpload` writes - confirming each via `IconStatus`
rather than assuming success from chunk delivery alone - and SHALL complete all of
those uploads before sending the `ConfigTransfer` push itself. This ordering means
the device is never left holding a configuration that references an icon id it
doesn't yet have, even momentarily.

#### Scenario: Uploading a newly-set icon before the config push
- **WHEN** the user pushes a configuration containing a slot whose icon the device does not yet have
- **THEN** the webapp uploads that icon's bitmap and confirms success via `IconStatus` reporting `uploaded` before it sends the `ConfigTransfer` push

#### Scenario: Icon upload is rejected
- **WHEN** an icon upload completes but `IconStatus` reports `rejected_wrong_size`
- **THEN** the webapp shows the user an error identifying which icon failed to upload, and does not proceed to push the configuration

### Requirement: Webapp pulls bitmaps for icons already referenced by a device's configuration
After pulling a device's configuration on connect, the webapp SHALL download the
bitmap for each distinct icon id referenced by that configuration (via
`IconTransferId` and `IconDownload`), so the editor can show accurate previews of
icons that already exist on the device, not just ones uploaded in the current
session.

#### Scenario: Existing icons are previewed after connecting
- **WHEN** the webapp connects to a device whose current configuration has one or more slots with an `icon` field
- **THEN** the webapp downloads each referenced icon's bitmap and displays it as that slot's preview

#### Scenario: A referenced icon that no longer exists on-device
- **WHEN** the webapp downloads an icon by id and `IconDownload` returns a zero-length payload
- **THEN** the editor shows that slot without an icon preview (falling back to its color) rather than a broken image
