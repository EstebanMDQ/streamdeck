## ADDED Requirements

### Requirement: Configuration persists to flash storage
The firmware SHALL persist the active configuration to LittleFS so that it is
available again after a power cycle without requiring reconnection to the webapp.

#### Scenario: Configuration survives a reboot
- **WHEN** the device is rebooted after a configuration was previously applied and persisted
- **THEN** the device loads and displays that same configuration on boot without any BLE connection

### Requirement: Configuration writes are atomic
The firmware SHALL write a new configuration to a temporary file and rename it over
the previous configuration file, rather than writing in place, so that a power loss
mid-write cannot corrupt the on-disk configuration.

#### Scenario: Power loss during a write does not corrupt existing config
- **WHEN** power is lost while a new configuration is being written to the temporary file
- **THEN** the previously persisted configuration file remains intact and loadable on next boot

### Requirement: Missing or invalid configuration falls back to a default
On boot, if no configuration file exists, the file cannot be parsed, or its
`schemaVersion` is unsupported, the firmware SHALL load a built-in default
configuration instead of failing to boot.

#### Scenario: First boot with no configuration file
- **WHEN** the device boots and no configuration file exists in LittleFS
- **THEN** the device loads its built-in default configuration and displays it

#### Scenario: Boot with a corrupted configuration file
- **WHEN** the device boots and the configuration file exists but cannot be parsed as valid JSON
- **THEN** the device loads its built-in default configuration instead of failing to boot

### Requirement: A configuration applied over BLE is persisted
When a configuration payload is validated and applied via the BLE config protocol,
the firmware SHALL also persist it to LittleFS as part of applying it.

#### Scenario: Config pushed over BLE survives a subsequent reboot
- **WHEN** a client pushes a valid new configuration over BLE and it is applied
- **THEN** rebooting the device afterward loads that same configuration, not the one that was active before the push
