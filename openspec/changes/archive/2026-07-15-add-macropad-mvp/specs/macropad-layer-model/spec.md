## ADDED Requirements

### Requirement: Layer contains up to six button slots
Each layer in the configuration SHALL define exactly six button slots (indices 0-5),
where each slot is either a configured button or empty.

#### Scenario: Empty slot renders and behaves as blank
- **WHEN** a layer's slot has no button configured
- **THEN** the slot is treated as empty and carries no action

### Requirement: Button action has exactly one of three types
Every configured button SHALL have an `action` of type `key`, `media`, or `layer`, and
no other type is valid. The exact field shape of each type is a normative contract
between firmware and webapp (they are built independently, with no shared code
generation), not merely illustrative:
- `key`: an integer `usage` field (a USB HID keyboard usage ID, e.g. `4` = 'a') and a
  `modifiers` array drawn only from `["ctrl", "shift", "alt", "gui"]` (possibly
  empty).
- `media`: a `key` field, one value from the fixed vocabulary `play_pause`, `next`,
  `prev`, `vol_up`, `vol_down`, `mute`.
- `layer`: a `target` field, a string layer id referencing another layer.

#### Scenario: Key action includes keyboard usage and modifiers
- **WHEN** a button's action type is `key`
- **THEN** the action includes an integer `usage` field and a `modifiers` array drawn only from `["ctrl", "shift", "alt", "gui"]`

#### Scenario: Media action includes a consumer-control key
- **WHEN** a button's action type is `media`
- **THEN** the action includes a `key` field whose value is one of `play_pause`, `next`, `prev`, `vol_up`, `vol_down`, `mute`

#### Scenario: Layer action includes a target layer id
- **WHEN** a button's action type is `layer`
- **THEN** the action includes a `target` field referencing another layer's id

### Requirement: Root layer always exists
The configuration SHALL always define a layer designated as the root layer, which is
shown on boot and cannot be deleted.

#### Scenario: Device boots into the root layer
- **WHEN** the device starts up with a valid configuration
- **THEN** the layer marked as root is the first layer displayed

### Requirement: Layers may be linked from multiple buttons
A single layer SHALL be a valid `target` for more than one `layer`-type button across
the configuration.

#### Scenario: Two buttons target the same layer
- **WHEN** two different buttons (in the same or different layers) both have action type `layer` with the same `target`
- **THEN** both buttons navigate to that same layer when pressed
