## ADDED Requirements

### Requirement: Editor allows uploading an icon for a button slot
For any of a layer's six slots, the editor SHALL allow the user to choose an image
file, which it converts client-side to a 64x64 RGB565 bitmap (cropping/resizing as
needed to fill the square) and associates with that slot as its `icon`. The editor
SHALL compute the icon's id as a content hash of the converted bitmap, so uploading
an identical image for a different slot reuses the same id instead of creating a
duplicate.

#### Scenario: Uploading an image for a slot
- **WHEN** a user chooses an image file for a slot
- **THEN** the editor converts it to a 64x64 RGB565 bitmap, computes its content-hash id, and sets that id as the slot's `icon`

#### Scenario: Uploading an identical image for a different slot reuses the id
- **WHEN** a user uploads an image that converts to bitmap bytes identical to an already-uploaded icon
- **THEN** the editor assigns the same icon id to the new slot rather than treating it as a distinct icon

### Requirement: Editor shows a live local preview of an uploaded icon
After converting an uploaded image for a slot, the editor SHALL display a preview of
the resulting 64x64 bitmap in that slot's grid cell, without needing to fetch it back
from the device first.

#### Scenario: Preview shown immediately after upload
- **WHEN** a user uploads and converts an image for a slot
- **THEN** the editor immediately shows a preview of the converted bitmap in that slot, before any BLE transfer occurs

### Requirement: Editor supports clearing a slot's icon independently of its other fields
The editor SHALL allow a user to remove a slot's `icon` reference while keeping its
label, color, and action unchanged, reverting that slot to a plain color fill.

#### Scenario: Clearing only the icon
- **WHEN** a user clears the icon from a slot that has a label, color, action, and icon configured
- **THEN** the slot keeps its label, color, and action, and no longer has an `icon` field
