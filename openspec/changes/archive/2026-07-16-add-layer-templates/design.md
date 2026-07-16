## Context

Every button today is hand-configured in the editor: pick an action type, then (for
`key` actions) look up the right USB HID usage code and modifiers. That's fine for a
one-off custom button, but tedious for reproducing a well-known shape like a DAW's
transport controls - exactly what was done by hand for the Logic Pro layer earlier in
this project. This change productizes that as a reusable template.

## Goals / Non-Goals

**Goals:**
- Let a user create a fully-populated 6-button layer in one action, from a small
  built-in library of named templates.
- Keep templates as plain data (label/color/action per slot), so applying one
  produces exactly the same shape `webapp-layer-editor` already knows how to create
  and edit by hand - no new runtime behavior, no new config schema fields, nothing
  firmware-side changes at all.
- Be honest in the UI about which template buttons rely on confirmed
  application-default shortcuts vs. ones the user must configure in the target
  application first (see Decisions - this varies a lot between the four templates).

**Non-Goals:**
- A marketplace/import mechanism for user-shared or third-party templates - this
  change ships a small fixed set of built-in templates as static data, not a
  template ecosystem.
- Editing a template itself from the UI (e.g. "save this layer as a new template") -
  templates are read-only presets for creating a layer; editing happens on the
  layer afterward, same as any other layer.
- Detecting which application is currently in focus and auto-switching - this is
  still a manual choice, matching the project's "the device never talks to a host
  process" architecture.

## Decisions

### Templates are plain data, not code
A template is `{ id, name, description, buttons: [slot|null, ...6] }`, where each
`slot` is exactly the same shape `webapp-layer-editor` already writes
(`{label, color, action}`). Templates live in a new `webapp/js/templates.js` as a
plain array/object export - no build step, no new dependency, consistent with the
rest of the webapp.

### Applying a template creates a new layer; nothing else changes
"Apply template" reuses the existing "create a new layer" flow (prompt for a
layer id), then populates that layer's six slots from the chosen template instead of
leaving them empty. This explicitly includes reusing the SAME duplicate-id check the
empty-layer path already has (`editor.js`'s `_createLayer()` rejects an id that
already exists) - template-based creation is not a second, parallel code path that
happens to also create a layer, it's the same creation function with a different
source for the initial six slots. Once created, a template-based layer is stored,
edited, deleted, and pushed exactly like any hand-built layer - `macropad-layer-model`,
`macropad-ble-config-protocol`, and the firmware are entirely unaware templates
exist. This is why there's no new capability needed on the firmware side at all.

### Seven initial templates, with per-button confidence explicitly tracked
Each template button's action was checked against the target application's actual
current documented defaults (not assumed from memory) before being written down.
Confidence varies a lot by application, and the template data itself records which
buttons are "just works" vs. "you must bind this yourself first" so the editor can
show that distinction to the user rather than silently presenting everything as
equally reliable:

- **Logic Pro Transport** (`logic-transport`) - all six buttons match the layer
  already hand-configured and confirmed working on real hardware earlier in this
  project: Play/Stop (Space, usage 44), Record (R, usage 21), Rewind (`,`, usage 54),
  Forward (`.`, usage 55), Return to start (Return, usage 40), Cycle (C, usage 6).
  Highest confidence of the four - the only one actually verified on-device.

- **Pro Tools Transport** (`protools-transport`) - built around shortcuts confirmed
  via Avid's own current shortcuts documentation: Play/Stop (Space, usage 44),
  Record (F12, usage 69), Rewind (numeric keypad 1, usage 89), Fast Forward (numeric
  keypad 2, usage 90). Pro Tools has two selectable numeric-keypad modes (Classic vs.
  Transport, set in Preferences > Operation) that disagree on what keys 4-9 do, but
  both modes agree keypad 0/1/2/3 mean Play-Stop/Rewind/Fast-Forward/Record - so this
  template deliberately only uses keys that are mode-independent, plus two
  universally-safe non-transport shortcuts to round out the six slots: Return to
  Start (Return, usage 40) and Save Session (Ctrl+S, usage 22 + ctrl modifier).

- **Ableton Live Transport** (`ableton-transport`) - Play/Stop (Space, usage 44),
  Restart from beginning (Shift+Space, usage 44 + shift modifier), and Record (F9,
  usage 66) are Ableton's own confirmed defaults. Undo uses usage 29 ('z') with the
  `gui` modifier (i.e. Cmd+Z on macOS, matching this project's own testing
  environment) rather than `ctrl` - Windows users would need to change this one
  button to `ctrl` after applying the template, called out here rather than silently
  picking a platform. Metronome and Tap Tempo are included as placeholder buttons
  (suggested as Ctrl+M / Ctrl+T) but Ableton ships with **no** default shortcut for
  either - flagged via `requiresSetup` (see below) with the note "map this in
  Ableton's Key Map Mode (Cmd/Ctrl+K) first." Exactly these two of the six Ableton
  buttons carry the flag; the other four (Play/Stop, Restart, Record, Undo) do not.

- **OBS Studio Scene Control** (`obs-scene-control`) - Start/Stop Streaming (Ctrl+F1,
  usage 58), Start/Stop Recording (Ctrl+F2, usage 59), Mute Mic (Ctrl+F3, usage 60),
  and three scene switches (Ctrl+F5/F6/F7, usages 62/63/64). Unlike the DAW
  templates, OBS ships with **no default global hotkeys at all** for any of these
  actions - every single one of the six buttons in this template carries the
  `requiresSetup` flag, with a note to assign that exact key combination to the
  matching action in OBS's Settings > Hotkeys first. This template exists to hand
  the user a ready-made, low-collision key scheme to bind to, not because OBS
  already responds to these keys.

- **Media Controls** (`media-controls`) - Play/Pause, Next, Previous, Volume Up,
  Volume Down, Mute - one `media` action per slot, covering the entire fixed media-key
  vocabulary `macropad-layer-model` already defines. Highest possible confidence:
  these aren't application shortcuts at all, they're the same OS-level media keys any
  BLE HID device sends, handled natively by the OS regardless of which app has focus.
  No buttons flagged.

- **Logic Pro Tools Palette** (`logic-tools`) - Pointer (T, usage 23), Pencil (P,
  usage 19), Eraser (E, usage 8), Scissors (I, usage 12), Marquee (R, usage 21), Mute
  (M, usage 16). Sourced directly from a screenshot of the user's own Logic Pro Tool
  Menu (single-key shortcuts, no modifiers) - ground truth from the actual
  application, not documentation or memory, after an initial web search on this
  specific topic came back internally inconsistent and was discarded rather than
  used. These six were chosen as the most frequently toggled tools during editing;
  Logic's Tool Menu also has Text, Join, Solo, Zoom, Fade, Automation Select/Curve,
  Flex, and Gain tools that didn't fit in six slots - a user who prefers a different
  six can just edit the buttons after applying the template, same as any other layer.
  No buttons flagged (this is the user's own live configuration, not a documented
  default that could be wrong).

- **DaVinci Resolve Edit** (`davinci-resolve-edit`) - Rewind (J, usage 13), Stop (K,
  usage 14), Play (L, usage 15), Mark In (I, usage 12), Mark Out (O, usage 18), and
  Split at Playhead (Cmd/Ctrl+B, usage 5 + `gui` modifier, same Mac-first convention
  as Ableton's Undo button - Windows users adjust to `ctrl`). J/K/L is the
  industry-standard shuttle convention (shared with Premiere and Avid, not unique to
  Resolve), and I/O/Split were confirmed via a clean, consistent web search - unlike
  the initial Logic Tools search, this one didn't contradict itself across sources.
  No buttons flagged.

- **App Launcher** (`app-launcher`) - six generic buttons ("App 1" through "App 6")
  sending Ctrl+Alt+1 through Ctrl+Alt+6 (usages 30-35, `ctrl`+`alt` modifiers) - a
  low-collision combo unlikely to already be bound to anything. This template exists
  because of a direct question during scoping: "can we do an app launcher button?"
  The honest answer, consistent with this project's locked-in architecture
  (`macropad-ble-hid`: the device only ever sends keystrokes, it never talks to a
  host process and cannot launch anything directly), is no - not as a new
  capability. What this template provides instead is the same pattern as the OBS
  template: a ready-made set of distinct hotkeys for the user to bind, via an
  OS-level tool of their choice (Hammerspoon, Keyboard Maestro, AutoHotkey, and
  similar all support "run this on hotkey X"), to actually launching a specific app.
  Every button carries `requiresSetup`, for a different reason than OBS's (there's no
  such thing as this working by default here, ever, not just "not yet configured in
  the target app") but the same mechanism.

### Per-button "requires setup" flag: exact shape
Each template button MAY carry two additional (template-only) fields alongside its
`label`/`color`/`action`: `requiresSetup: true` (boolean) and `setupNote: "..."`
(a short string, e.g. "Bind this in Ableton's Key Map Mode first"). Buttons that
don't need setup simply omit both fields entirely - not `requiresSetup: false`. The
editor shows `setupNote` as a small indicator on any template button that has
`requiresSetup: true` before it's applied, and BOTH fields are stripped when the
template is applied to create a layer - the resulting button is exactly
`{label, color, action}`, identical in shape to a hand-built one
(`macropad-layer-model`'s button shape is completely unchanged).

## Risks / Trade-offs

- **Keyboard shortcuts drift across application versions/user customization** →
  templates are a starting point, not a promise; the per-button "requires setup" flag
  and the confidence notes above make the trade-offs visible rather than implying
  false certainty. Users who've customized their own app's shortcuts will need to
  adjust the corresponding button regardless - normal editing, not a special flow.
- **OBS and Ableton's metronome/tap-tempo templates are mostly placeholders** →
  acceptable and clearly surfaced (see Decisions) rather than a hidden gap; still
  useful as a starting point that saves the user from picking HID usage codes by
  hand even when they do need to bind the matching shortcut in the target app first.
