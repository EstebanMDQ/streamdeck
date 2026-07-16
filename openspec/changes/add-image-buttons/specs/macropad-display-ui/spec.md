## MODIFIED Requirements

### Requirement: Current layer's six buttons are rendered on screen
The display SHALL render the six button slots of the currently active layer. For a
configured slot with no `icon` field, it SHALL show the label over the background
color, as before. For a configured slot with an `icon` field referencing an icon that
loads successfully, the display SHALL render that icon bitmap as the slot's
background instead of the flat color, with the label still drawn as an overlay. If a
slot's referenced icon cannot be loaded (missing or invalid file), the display SHALL
fall back to rendering that slot with its background color, as if no icon were set.
Empty slots continue to render blank.

#### Scenario: Configured button shows label and color
- **WHEN** a slot has a configured button with a label and color, and no icon
- **THEN** the display renders that label over that background color in the slot's position

#### Scenario: Configured button with a loadable icon shows the icon and label
- **WHEN** a slot has a configured button with an `icon` field referencing an icon that loads successfully
- **THEN** the display renders that icon bitmap as the slot's background with the label overlaid, instead of the flat color fill

#### Scenario: Configured button with an unloadable icon falls back to color
- **WHEN** a slot has a configured button with an `icon` field referencing an icon that fails to load (missing or invalid file)
- **THEN** the display renders that slot with its background color and label, as if the icon field were absent

#### Scenario: Empty slot renders blank
- **WHEN** a slot has no button configured
- **THEN** the display renders that slot without a label or interactive appearance
