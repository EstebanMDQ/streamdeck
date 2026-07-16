## 1. Template data

- [x] 1.1 Create `webapp/js/templates.js` exporting the template library data structure (`{ id, name, description, buttons: [slot|null, ...6] }`), where a button MAY carry `requiresSetup: true` + `setupNote` (omitted entirely when not needed)
- [x] 1.2 Define the "Logic Pro Transport" template (Play/Stop usage 44, Record usage 21, Rewind usage 54, Forward usage 55, Return to start usage 40, Cycle usage 6) matching the layer already verified on real hardware - no buttons flagged
- [x] 1.3 Define the "Pro Tools Transport" template (Play/Stop usage 44, Record usage 69, Rewind usage 89, Fast Forward usage 90, Return to Start usage 40, Save Session usage 22 + ctrl) using the mode-independent keypad codes from design.md - no buttons flagged
- [x] 1.4 Define the "Ableton Live Transport" template (Play/Stop usage 44, Restart usage 44 + shift, Record usage 66, Undo usage 29 + gui, Metronome, Tap Tempo) - flag exactly Metronome and Tap Tempo with `requiresSetup: true` + `setupNote`; the other four have neither field
- [x] 1.5 Define the "OBS Studio Scene Control" template (Stream usage 58 + ctrl, Record usage 59 + ctrl, Mute Mic usage 60 + ctrl, Scene 1/2/3 usages 62/63/64 + ctrl) - flag all six buttons with `requiresSetup: true` + `setupNote`
- [x] 1.6 Add JS unit tests confirming every template has exactly 6 slots (or `null`), every non-null slot has a valid `action` shape (matching `macropad-layer-model`'s modifier vocabulary and media-key list where applicable), the OBS template has `requiresSetup` on all 6 buttons, and the Ableton template has it on exactly Metronome and Tap Tempo
- [x] 1.7 Implement the pure "apply template" function (template + layer id -> new layer object) as its own testable unit, and add a JS unit test confirming it strips `requiresSetup`/`setupNote` from every button, producing plain `{label, color, action}` shapes only
- [x] 1.8 Define the "Media Controls" template (Play/Pause, Next, Previous, Volume Up, Volume Down, Mute - one `media` action per slot, covering the full media-key vocabulary) - no buttons flagged
- [x] 1.9 Define the "Logic Pro Tools Palette" template (Pointer usage 23, Pencil usage 19, Eraser usage 8, Scissors usage 12, Marquee usage 21, Mute usage 16 - sourced directly from the user's own Logic Pro Tool Menu) - no buttons flagged
- [x] 1.10 Define the "DaVinci Resolve Edit" template (Rewind/J usage 13, Stop/K usage 14, Play/L usage 15, Mark In/I usage 12, Mark Out/O usage 18, Split usage 5 + gui) - no buttons flagged
- [x] 1.11 Define the "App Launcher" template (6 generic "App N" buttons, Ctrl+Alt+1 through Ctrl+Alt+6, usages 30-35 + ctrl+alt) - flag all six buttons with `requiresSetup: true` + `setupNote` explaining the device can't launch apps directly and the key must be bound via an OS-level tool
- [x] 1.12 Extend the unit tests from 1.6 to cover all 8 templates (still exactly 6 slots each with valid action shapes), plus new assertions that the App Launcher template has `requiresSetup` on all 6 buttons and Media Controls/Logic Tools Palette/DaVinci Resolve Edit have it on none

## 2. Editor: create layer from template

- [x] 2.1 Add a "New layer from template" entry point alongside the existing "+ New layer" button
- [x] 2.2 Show the template library (name + description) for the user to choose from, including each template's per-button setup notes before applying
- [x] 2.3 Wire the entry point to the same layer-id-collision check `_createLayer()` already uses for empty layers (reject a duplicate id instead of overwriting), then call the pure apply-template function from 1.7 to populate the new layer
- [x] 2.4 Verify manually in the browser: applying each of the four templates produces a correctly-populated layer, attempting a duplicate layer id is rejected the same way as the empty-layer path, and the resulting layer edits/deletes/pushes exactly like a hand-built one (confirmed working)
- [x] 2.5 Verify manually in the browser: applying Media Controls, Logic Pro Tools Palette, DaVinci Resolve Edit, and App Launcher each produce a correctly-populated layer (confirmed working)

## 3. Documentation

- [x] 3.1 Update the README to mention the template library, and note explicitly that the OBS template (all six buttons) and two Ableton buttons require binding matching hotkeys inside the target application first
- [x] 3.2 Update the README's template list with Media Controls, Logic Pro Tools Palette, DaVinci Resolve Edit, and App Launcher, noting that every App Launcher button requires binding to an app launch externally
