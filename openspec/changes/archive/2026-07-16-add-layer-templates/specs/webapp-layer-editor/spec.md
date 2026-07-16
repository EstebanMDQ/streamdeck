## ADDED Requirements

### Requirement: Editor supports creating a new layer from a template
Alongside creating an empty layer, the editor SHALL allow a user to create a new
layer pre-populated with a chosen template's buttons. The user still provides the
new layer's id, exactly as when creating an empty layer, and creating a layer from a
template SHALL be subject to the same duplicate-id handling as creating an empty
layer (rejecting an id that already exists) rather than a separate, parallel check.
A layer created this way is otherwise indistinguishable from a hand-built one - it
can be edited, have slots cleared or changed, and be deleted using the same existing
editor requirements, and remains subject to the existing pre-push validation
requirement like any other layer.

#### Scenario: Creating a layer from a template
- **WHEN** a user chooses a template and provides a new layer id that doesn't already exist
- **THEN** a new layer is created with that id, with its six slots populated from the template's button definitions

#### Scenario: Creating a layer from a template with a duplicate id is rejected
- **WHEN** a user chooses a template and provides a layer id that already exists
- **THEN** the editor rejects it the same way it would for an empty-layer creation with a duplicate id, and does not overwrite the existing layer

#### Scenario: A template-created layer is editable like any other
- **WHEN** a user edits, clears, or deletes a slot in a layer that was created from a template
- **THEN** the change applies exactly as it would for a hand-built layer, with no special handling
