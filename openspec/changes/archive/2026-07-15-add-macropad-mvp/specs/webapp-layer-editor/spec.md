## ADDED Requirements

### Requirement: Webapp is a static site with no backend
The layer editor SHALL run entirely as static HTML/CSS/JS served from GitHub Pages,
with no server-side component required for the editing experience itself.

#### Scenario: Editor loads from a static host
- **WHEN** a user opens the webapp's GitHub Pages URL
- **THEN** the editor UI loads and is usable without contacting any backend service

### Requirement: Editor displays a layer's six button slots
The editor SHALL display the six button slots of a selected layer, showing each
slot's label, color, and action type, matching the on-device grid layout.

#### Scenario: Selecting a layer shows its six slots
- **WHEN** a user selects a layer in the editor
- **THEN** the editor shows all six of that layer's slots, including empty ones

### Requirement: Editor allows configuring a button's label, color, and action
For any of a layer's six slots, the editor SHALL allow setting the label text,
background color, and one action (`key`, `media`, or `layer`) with its associated
parameters.

#### Scenario: Configuring a key action
- **WHEN** a user sets a slot's action type to `key` and chooses a keyboard usage and modifiers
- **THEN** the editor stores that slot as a `key` action with the chosen usage and modifiers

#### Scenario: Configuring a media action
- **WHEN** a user sets a slot's action type to `media` and chooses a supported media key
- **THEN** the editor stores that slot as a `media` action with the chosen key

#### Scenario: Configuring a layer-link action
- **WHEN** a user sets a slot's action type to `layer` and selects a target layer (including newly created ones)
- **THEN** the editor stores that slot as a `layer` action referencing the selected target

### Requirement: Editor supports creating new layers
The editor SHALL allow a user to create a new layer, which becomes available as a
`target` for `layer`-type button actions.

#### Scenario: Creating a new layer
- **WHEN** a user creates a new layer and gives it a name/id
- **THEN** the new layer appears in the layer list and is selectable as a target for `layer`-type actions

### Requirement: Editor supports clearing a button slot
The editor SHALL allow a user to clear a configured slot back to empty (no label,
color, or action).

#### Scenario: Clearing a configured slot
- **WHEN** a user clears a slot that previously had a button configured
- **THEN** the slot becomes empty (`null`) in the edited configuration

### Requirement: Editor supports deleting a layer
The editor SHALL allow a user to delete a layer that is not the root layer. If any
`layer`-type button (in any layer) still targets it, the editor SHALL block the
deletion and identify the referencing button(s) instead of deleting it.

#### Scenario: Deleting an unreferenced layer
- **WHEN** a user deletes a non-root layer that no `layer`-type button currently targets
- **THEN** the layer is removed from the layer list and is no longer selectable as a target

#### Scenario: Deleting a layer that is still referenced
- **WHEN** a user attempts to delete a non-root layer that at least one `layer`-type button still targets
- **THEN** the editor blocks the deletion and shows an error identifying the referencing button(s)

### Requirement: Editor blocks pushing an invalid configuration
Before allowing a configuration to be pushed to the device, the editor SHALL validate
it (e.g. every `layer`-type action's `target` refers to an existing layer) and SHALL
surface a clear error instead of allowing the push if validation fails.

#### Scenario: Layer-link button with a missing target
- **WHEN** a user attempts to push a configuration containing a `layer`-type action whose `target` does not exist
- **THEN** the editor blocks the push and shows an error identifying the invalid button
