## ADDED Requirements

### Requirement: Icon bitmaps are fixed-size RGB565 files stored by id
The firmware SHALL store each icon as a raw RGB565 bitmap file of exactly 8192 bytes
(64x64 pixels, 2 bytes/pixel), addressable by a string id, independent of the main
configuration JSON.

#### Scenario: A stored icon is exactly the expected size
- **WHEN** an icon is saved on-device
- **THEN** its stored file is exactly 8192 bytes

### Requirement: Config service exposes an icon transfer target characteristic
The firmware SHALL expose an `IconTransferId` characteristic (write) that sets which
icon id subsequent `IconUpload` writes or `IconDownload` reads apply to.

#### Scenario: Setting the transfer target before an upload or download
- **WHEN** a client writes an icon id to `IconTransferId`
- **THEN** the device associates the next `IconUpload` or `IconDownload` operation with that id

### Requirement: Icon upload is validated for exact size before being saved
The firmware SHALL expose an `IconUpload` characteristic (write with response) using
the same chunked `[uint16 totalLength][uint16 offset][payload]` framing as
`ConfigTransfer`. Once a chunked payload is fully reassembled, the firmware SHALL
save it as the icon file for the id set via `IconTransferId` only if it is exactly
8192 bytes, and SHALL reject it otherwise without saving anything.

#### Scenario: Correctly-sized icon upload is saved
- **WHEN** a client uploads a reassembled icon payload of exactly 8192 bytes
- **THEN** the device saves it as the icon file for the previously set transfer id

#### Scenario: Wrong-sized icon upload is rejected
- **WHEN** a client uploads a reassembled icon payload that is not exactly 8192 bytes
- **THEN** the device discards the payload and does not create or overwrite any icon file

### Requirement: Icon download streams a stored bitmap by id, or an empty response if not found
The firmware SHALL expose an `IconDownload` characteristic (read + notify) that,
when read, streams the icon file for the id set via `IconTransferId` back to the
client using the same chunked framing as `ConfigDump`. If no icon file exists for
that id, the firmware SHALL respond with a zero-length payload rather than an error.

#### Scenario: Downloading an existing icon
- **WHEN** a client sets a transfer id for an icon that exists on-device and reads `IconDownload`
- **THEN** the device streams that icon's 8192 bytes back in framed chunks

#### Scenario: Downloading a non-existent icon
- **WHEN** a client sets a transfer id for which no icon file exists and reads `IconDownload`
- **THEN** the device responds with a zero-length payload instead of an error, and `IconStatus` updates to `not_found`

### Requirement: Icon status reports the outcome of the last icon operation
The firmware SHALL expose an `IconStatus` characteristic (read + notify) reporting
one of `none`, `uploaded`, `rejected_wrong_size`, `downloaded`, or `not_found`,
reflecting the most recently completed icon upload or download operation.

#### Scenario: Status reflects a successful upload
- **WHEN** an icon upload completes and is saved
- **THEN** `IconStatus` updates to `uploaded`

#### Scenario: Status reflects a rejected upload
- **WHEN** an icon upload completes but is rejected for being the wrong size
- **THEN** `IconStatus` updates to `rejected_wrong_size`

#### Scenario: Status reflects a successful download
- **WHEN** an `IconDownload` read completes streaming an existing icon's bytes
- **THEN** `IconStatus` updates to `downloaded`

#### Scenario: Status reflects a not-found lookup
- **WHEN** an `IconDownload` read completes with a zero-length response because no icon exists for the set transfer id
- **THEN** `IconStatus` updates to `not_found`

### Requirement: Only one icon transfer is in flight at a time
The firmware SHALL track at most one in-progress `IconUpload` reassembly buffer,
scoped to the icon id most recently set via `IconTransferId`. Writing a new value to
`IconTransferId` while a previous `IconUpload` for a different id is still
incomplete SHALL discard that stale partial buffer. A BLE disconnect SHALL also
discard any in-progress partial buffer. An `IconUpload` chunk received while no icon
id has ever been set via `IconTransferId` SHALL be discarded silently, mirroring how
`ConfigTransfer` discards chunks it can't attribute to a legitimate transfer.

#### Scenario: Changing the transfer id mid-upload discards the stale buffer
- **WHEN** a client writes a new id to `IconTransferId` while a previously-started `IconUpload` for a different id is still incomplete
- **THEN** the device discards the incomplete buffer and any further chunks are attributed to the new id only

#### Scenario: Disconnect mid-upload discards the partial buffer
- **WHEN** the BLE connection drops after some but not all chunks of an `IconUpload` have been received
- **THEN** the device discards the partially-received buffer and does not apply it on reconnect

#### Scenario: Upload chunk with no transfer id set is discarded
- **WHEN** an `IconUpload` chunk is received before any id has been written to `IconTransferId`
- **THEN** the device discards the chunk without saving any file or updating `IconStatus`
