## Purpose

Defines the custom BLE GATT protocol the firmware exposes for pushing and
pulling the macro pad's layer/button configuration from the webapp, including
chunked transfer framing and result reporting.

## Requirements

### Requirement: Config service exposes a chunked write characteristic
The firmware SHALL expose a `ConfigTransfer` characteristic (write with response)
that accepts a configuration payload split across one or more writes, each framed
with a total length and an offset, and SHALL reassemble the payload once all bytes
are received. Using write-with-response ensures each chunk write is acknowledged at
the ATT layer before the client sends the next one.

#### Scenario: Single-chunk write within one MTU
- **WHEN** a client writes a config payload that fits in one `ConfigTransfer` write
- **THEN** the device reassembles it as a complete payload once that single write is acknowledged

#### Scenario: Multi-chunk write spanning several writes
- **WHEN** a client writes a config payload split across multiple `ConfigTransfer` writes with increasing offsets
- **THEN** the device buffers each acknowledged chunk and reassembles the complete payload once the final offset plus length equals the declared total length

### Requirement: Only one configuration transfer is in flight at a time
The firmware SHALL track at most one in-progress `ConfigTransfer` reassembly buffer,
and SHALL discard any partially-received buffer when the BLE connection is lost, when
a new transfer (a write at offset 0 with a new total length) begins before the
previous one completed, or when more than ~15 seconds pass between consecutive chunks
of the same transfer.

#### Scenario: Disconnect mid-transfer discards the partial buffer
- **WHEN** the BLE connection drops after some but not all chunks of a transfer have been received
- **THEN** the device discards the partially-received buffer and does not apply it on reconnect

#### Scenario: A new transfer starting discards a stale partial buffer
- **WHEN** a client begins a new `ConfigTransfer` (offset 0) while a previous transfer's buffer is still incomplete
- **THEN** the device discards the stale partial buffer and reassembles only the new transfer

#### Scenario: Inactivity mid-transfer discards the partial buffer
- **WHEN** more than approximately 15 seconds elapse between two chunks of the same in-progress transfer
- **THEN** the device discards the partial buffer so a later transfer isn't corrupted by stale bytes

### Requirement: Config service exposes a chunked read/notify characteristic
The firmware SHALL expose a `ConfigDump` characteristic that streams the current
configuration out using the same length/offset framing as `ConfigTransfer`, so a
client can read back the full current configuration.

#### Scenario: Client requests the current configuration
- **WHEN** a client subscribes to or reads `ConfigDump`
- **THEN** the device sends the current configuration in one or more framed chunks that reassemble to the full configuration JSON

### Requirement: Config service exposes a status characteristic including last apply result
The firmware SHALL expose a `ConfigStatus` characteristic (read + notify) reporting
the firmware version, the configuration `schemaVersion` it supports, and
`lastApplyResult` - one of `none`, `applied`, `rejected_invalid_json`,
`rejected_schema_version`, or `rejected_structure` - reflecting the outcome of the
most recently completed `ConfigTransfer`.

#### Scenario: Client reads status before pushing a config
- **WHEN** a client reads `ConfigStatus` before pushing
- **THEN** it receives the current firmware version, supported schema version, and the `lastApplyResult` of whatever transfer last completed (or `none` if none has completed since boot)

#### Scenario: Client observes the result of its own push
- **WHEN** a client's `ConfigTransfer` finishes reassembling and the device finishes validating it
- **THEN** `ConfigStatus.lastApplyResult` updates (and notifies subscribers) to `applied` or the specific rejection reason, so the client does not have to assume success just because chunks were acknowledged

### Requirement: Reassembled configuration is validated syntactically and structurally before being applied
The firmware SHALL parse and validate a reassembled `ConfigTransfer` payload before
applying it. Validation SHALL check, in order: (1) the payload is valid JSON, (2) its
`schemaVersion` is supported, (3) every layer has exactly six slots, every non-null
button's `action.type` is one of `key`/`media`/`layer`, and every `media.key` is in
the supported vocabulary. If a payload fails any check, the firmware SHALL discard it
without altering the active configuration and SHALL set `ConfigStatus.lastApplyResult`
to the corresponding rejection reason.

#### Scenario: Valid configuration is applied
- **WHEN** a reassembled payload is valid JSON, has a supported `schemaVersion`, and every layer/button passes structural checks
- **THEN** the device applies it as the active configuration and sets `lastApplyResult` to `applied`

#### Scenario: Malformed JSON is rejected
- **WHEN** a reassembled payload is not valid JSON
- **THEN** the device discards the payload, keeps its previous configuration, and sets `lastApplyResult` to `rejected_invalid_json`

#### Scenario: Unsupported schema version is rejected
- **WHEN** a reassembled payload is valid JSON but has an unsupported `schemaVersion`
- **THEN** the device discards the payload, keeps its previous configuration, and sets `lastApplyResult` to `rejected_schema_version`

#### Scenario: Structurally invalid configuration is rejected
- **WHEN** a reassembled payload is valid JSON with a supported `schemaVersion` but has a layer without exactly six slots, a button with an unrecognized `action.type`, or a `media` action whose `key` is outside the supported vocabulary
- **THEN** the device discards the payload, keeps its previous configuration, and sets `lastApplyResult` to `rejected_structure`
