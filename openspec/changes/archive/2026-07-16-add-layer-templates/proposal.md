## Why

Building a useful layer from scratch (e.g. the Logic Pro transport layer configured
manually earlier) means looking up HID usage codes for every button by hand. Most of
that work is reusable: the same "DAW transport" or "streaming control" shape comes up
across users and sessions. A small built-in library of layer templates lets a user
create a fully-populated layer in one click instead of configuring six buttons one at
a time, while still being free to edit or delete any button afterward like any other
layer.

## What Changes

- The webapp gains a library of built-in layer templates - each a named preset of up
  to six pre-configured buttons (label, color, action) - that a user can apply to
  instantly create a new layer, instead of always starting from an empty one.
- Four templates ship initially:
  - **Logic Pro Transport** - the exact layer already hand-built and verified on real
    hardware earlier (Play/Stop, Record, Rewind, Forward, Return to start, Cycle).
  - **Pro Tools Transport** - Play/Stop, Record, Rewind, Fast Forward, Return to
    Start, Save, using Pro Tools' confirmed defaults (Space, F12, and numeric-keypad
    Rewind/Fast-Forward, which are identical between Pro Tools' two selectable keypad
    modes).
  - **Ableton Live Transport** - Play/Stop, Restart, Record, and Undo use Ableton's
    confirmed defaults (Space, Shift+Space, F9, Ctrl/Cmd+Z); Metronome and Tap Tempo
    are included but explicitly marked as needing the user to map them in Ableton
    first, since Ableton ships with no default shortcut for either.
  - **OBS Studio Scene Control** - Stream/Record toggles, mic mute, and three scene
    switches. Unlike the DAW templates, OBS ships with no default global hotkeys at
    all - every button in this template is a suggested key combination the user must
    assign to the matching action in OBS's own Settings > Hotkeys before it does
    anything. This is documented clearly in the template's own description, not just
    in the README.
- Applying a template creates a new layer (the user still names/ids it) pre-populated
  with that template's buttons; nothing about existing layers, the config schema, or
  the BLE protocol changes - a template-created layer is indistinguishable from a
  hand-built one once created.

## Capabilities

### New Capabilities
- `webapp-layer-templates`: the built-in template library (data + the four initial
  templates) and the editor flow for creating a new layer from a chosen template.

### Modified Capabilities
- `webapp-layer-editor`: the "create a new layer" flow gains a second path (from a
  template) alongside the existing "create an empty layer" path; no change to how a
  layer behaves once created.

## Impact

- Webapp: new template data (`webapp/js/templates.js` or similar) and editor UI for
  choosing a template when creating a layer. No firmware, BLE protocol, or config
  schema changes whatsoever - templates only ever produce the exact same
  label/color/action button shape the editor already writes by hand today.
- No new dependencies. Template button definitions are plain data, not code.
