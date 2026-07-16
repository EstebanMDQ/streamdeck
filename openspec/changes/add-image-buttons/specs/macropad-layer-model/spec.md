## ADDED Requirements

### Requirement: Button slot may include an optional icon
The configuration format SHALL allow a configured button slot to optionally include
an `icon` field (a string icon id referencing a bitmap stored via
`macropad-icon-assets`), independent of and in addition to its existing `label`,
`color`, and `action` fields. A slot with no `icon` field SHALL behave exactly as
before (label + color only).

#### Scenario: Button slot with an icon reference
- **WHEN** a button slot's JSON includes an `icon` field with a string value
- **THEN** the slot is treated as having an icon reference in addition to its label, color, and action

#### Scenario: Button slot without an icon field is unaffected
- **WHEN** a button slot's JSON has no `icon` field
- **THEN** the slot behaves exactly as it did before this capability existed - label and color only
