## Purpose

Defines how the firmware acts as a BLE HID keyboard/media-control peripheral,
translating button presses into HID reports sent to a connected host.

## Requirements

### Requirement: Device advertises as a BLE HID keyboard/media-control peripheral
The firmware SHALL advertise and pair over BLE using the HID-over-GATT profile,
presenting itself to hosts as a combined keyboard and consumer-control device.

#### Scenario: Host discovers and pairs with the device
- **WHEN** a host scans for BLE HID devices while the firmware is advertising
- **THEN** the device is discoverable and completes pairing as a keyboard/media-control peripheral

### Requirement: Key-action button press emits the configured keyboard report
Pressing a button whose action type is `key` SHALL send a HID keyboard report
containing that action's keyboard usage identifier and modifiers to the connected
host.

#### Scenario: Pressing a key-action button while connected
- **WHEN** a `key`-type button is pressed and a host is connected
- **THEN** the host receives a keyboard HID report matching the button's configured usage and modifiers

### Requirement: Media-action button press emits the configured consumer-control report
Pressing a button whose action type is `media` SHALL send a HID consumer-control
report matching that action's media-key value to the connected host.

#### Scenario: Pressing a media-action button while connected
- **WHEN** a `media`-type button is pressed and a host is connected
- **THEN** the host receives a consumer-control HID report matching the button's configured media key

### Requirement: Layer-action button press never emits a HID report
Pressing a button whose action type is `layer` SHALL only trigger on-device
navigation and SHALL NOT send any HID report to the host.

#### Scenario: Pressing a layer-action button
- **WHEN** a `layer`-type button is pressed
- **THEN** the display navigates to the target layer and no HID report is sent

### Requirement: Actions are silently dropped when no host is connected
If no host is currently connected over BLE HID, pressing a `key` or `media` button
SHALL still perform on-device visual feedback but SHALL NOT queue or retry the HID
report once a connection is later established.

#### Scenario: Pressing an action button while disconnected
- **WHEN** a `key` or `media` button is pressed and no BLE HID host is connected
- **THEN** no HID report is sent and none is sent retroactively after a host later connects
