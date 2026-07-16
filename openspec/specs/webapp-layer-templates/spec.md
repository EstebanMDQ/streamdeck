## Purpose

Defines a built-in library of named layer templates that the webapp ships with,
letting a user pre-populate a newly created layer's six button slots from a
ready-made preset instead of building it by hand.

## Requirements

### Requirement: A built-in library of layer templates is available
The webapp SHALL ship a built-in library of named layer templates, each defining up
to six button slots (label, color, and action) that can be used to populate a newly
created layer, independent of any device connection.

#### Scenario: Templates are available without a device connected
- **WHEN** the webapp is opened, whether or not it is connected to a device
- **THEN** the built-in template library is available for creating a layer from

### Requirement: The initial template library includes eight named templates
The built-in library SHALL include, at minimum, templates named "Logic Pro
Transport", "Pro Tools Transport", "Ableton Live Transport", "OBS Studio Scene
Control", "Media Controls", "Logic Pro Tools Palette", "DaVinci Resolve Edit", and
"App Launcher", each with a short description of what it's for.

#### Scenario: All eight initial templates are listed
- **WHEN** a user views the list of available templates
- **THEN** "Logic Pro Transport", "Pro Tools Transport", "Ableton Live Transport", "OBS Studio Scene Control", "Media Controls", "Logic Pro Tools Palette", "DaVinci Resolve Edit", and "App Launcher" are all present, each with a description

### Requirement: A template button may be flagged as requiring setup in the target application
A template's button definition MAY include `requiresSetup: true` alongside a
`setupNote` string, for buttons whose key combination is only a suggestion the user
must first bind to the corresponding action inside the target application (as
opposed to a shortcut that already works by that application's own default). A
button that does not need setup SHALL omit both fields entirely (not
`requiresSetup: false`). Neither field SHALL appear in the resulting layer's button
once a template is applied - both are template metadata only, not config fields; the
resulting button SHALL contain only `label`, `color`, and `action`.

#### Scenario: A flagged template button shows its setup note before being applied
- **WHEN** a user is viewing a template's buttons before applying it, and one has `requiresSetup: true`
- **THEN** the editor shows that button's `setupNote` (e.g. "bind this in the target app first")

#### Scenario: Applying a template strips setup metadata from the created button
- **WHEN** a template button with `requiresSetup: true` and a `setupNote` is applied to a layer
- **THEN** the resulting button in the layer has only `label`, `color`, and `action` - no `requiresSetup` or `setupNote` field

### Requirement: The OBS Studio Scene Control template flags every button as requiring setup
Because OBS Studio ships with no default global hotkeys for any action, every button
in the "OBS Studio Scene Control" template SHALL have `requiresSetup: true` with a
`setupNote` directing the user to OBS's Settings > Hotkeys.

#### Scenario: Every OBS template button requires setup
- **WHEN** a user views the "OBS Studio Scene Control" template's buttons
- **THEN** all of its buttons show a setup note, with none presented as already working by default

### Requirement: The Ableton Live Transport template flags exactly its two shortcut-less buttons
Because Ableton Live has no default shortcut for Metronome or Tap Tempo, exactly
those two buttons in the "Ableton Live Transport" template SHALL have
`requiresSetup: true`; its other buttons (Play/Stop, Restart, Record, Undo) SHALL
NOT have the flag, since those match Ableton's own confirmed defaults.

#### Scenario: Only Metronome and Tap Tempo require setup in the Ableton template
- **WHEN** a user views the "Ableton Live Transport" template's buttons
- **THEN** only the Metronome and Tap Tempo buttons show a setup note; Play/Stop, Restart, Record, and Undo do not

### Requirement: The App Launcher template flags every button as requiring setup
Because the device can only ever send a keystroke - it has no mechanism to launch an
application directly (see `macropad-ble-hid`'s architecture) - every button in the
"App Launcher" template SHALL have `requiresSetup: true` with a `setupNote`
directing the user to bind that button's keystroke to launching a specific
application, using an OS-level tool of their choice (e.g. Hammerspoon, Keyboard
Maestro, AutoHotkey).

#### Scenario: Every App Launcher template button requires setup
- **WHEN** a user views the "App Launcher" template's buttons
- **THEN** all of its buttons show a setup note explaining that the keystroke must be bound to an app launch externally, with none presented as already launching anything by default
