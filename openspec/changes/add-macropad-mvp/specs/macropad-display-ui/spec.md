## ADDED Requirements

### Requirement: Current layer's six buttons are rendered on screen
The display SHALL render the six button slots of the currently active layer, showing
each configured button's label and background color, and rendering empty slots blank.

#### Scenario: Configured button shows label and color
- **WHEN** a slot has a configured button with a label and color
- **THEN** the display renders that label over that background color in the slot's position

#### Scenario: Empty slot renders blank
- **WHEN** a slot has no button configured
- **THEN** the display renders that slot without a label or interactive appearance

### Requirement: Touch input maps to the correct button slot
The touch driver SHALL translate a touch coordinate into the index of the button slot
being touched, accounting for the display's resolution and orientation.

#### Scenario: Touch within a button's bounds selects that button
- **WHEN** the user touches a point within a rendered button's bounds
- **THEN** the system identifies the corresponding slot as pressed

#### Scenario: Touch on an empty slot has no effect
- **WHEN** the user touches a point within an empty slot's bounds
- **THEN** no action is triggered and no navigation occurs

### Requirement: Pressing a layer-type button navigates into that layer
When a pressed button's action type is `layer`, the display SHALL switch to showing
that layer's six button slots.

#### Scenario: Navigating into a nested layer
- **WHEN** the user presses a button whose action type is `layer`
- **THEN** the display replaces the current six buttons with the target layer's six buttons

### Requirement: Back affordance is shown only outside the root layer
The display SHALL show a persistent back affordance, separate from the six button
slots, whenever the active layer is not the root layer, and SHALL hide it while on the
root layer.

#### Scenario: Back affordance hidden on root layer
- **WHEN** the active layer is the root layer
- **THEN** no back affordance is shown

#### Scenario: Back affordance shown on a nested layer
- **WHEN** the active layer is not the root layer
- **THEN** a back affordance is shown

#### Scenario: Pressing back returns to the parent layer
- **WHEN** the user presses the back affordance while on a nested layer
- **THEN** the display returns to the layer that was active immediately before navigating into the current one

### Requirement: Button press shows visual feedback regardless of action delivery
Pressing any non-empty button slot SHALL produce a brief visual feedback (e.g. a
short highlight or color invert) on that slot, independent of whether the underlying
action (HID report or layer navigation) was actually delivered or is even possible
(e.g. no BLE host connected). This gives the user a consistent "the tap registered"
signal without implying delivery confirmation, which does not exist for one-way HID
reports.

#### Scenario: Feedback shown while a host is connected
- **WHEN** a non-empty button slot is pressed and a BLE HID host is connected
- **THEN** the slot briefly shows visual feedback in addition to any HID report being sent

#### Scenario: Feedback shown while no host is connected
- **WHEN** a non-empty button slot is pressed and no BLE HID host is connected
- **THEN** the slot still briefly shows visual feedback, even though no HID report is sent

### Requirement: Navigation resets to root if the active layer disappears from a new configuration
If a new configuration is applied while the currently displayed layer is not the root
layer, and that layer's id no longer exists in the newly applied configuration, the
display SHALL switch to the new configuration's root layer rather than continuing to
show the stale layer.

#### Scenario: Active nested layer removed by a config push
- **WHEN** a new configuration is applied while a non-root layer is displayed, and that layer's id is absent from the new configuration
- **THEN** the display switches to the new configuration's root layer
