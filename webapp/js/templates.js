// Built-in layer templates: named presets of up to six pre-configured buttons
// that create a fully-populated layer in one action, instead of configuring
// every button by hand. Plain data only - a template button is exactly the
// same shape the editor already writes (`{label, color, action}`), plus
// template-only fields (`requiresSetup`, `setupNote`, `iconGlyph`) that are
// stripped when a template is applied (see applyTemplate() below).
// `iconGlyph` names a procedurally-drawn icon from glyphs.js - the editor
// (not this file, which stays Canvas-free and unit-testable) turns it into
// a real generated icon id when the template is actually applied. Implements:
//   openspec/changes/add-layer-templates/specs/webapp-layer-templates/spec.md

import { BUTTONS_PER_LAYER } from "./model.js";

// Each button's HID usage code/modifiers were checked against the target
// application's actual current shortcut documentation (see design.md), not
// assumed from memory. Confidence varies per template - see each template's
// description and per-button requiresSetup/setupNote fields.

export const TEMPLATES = [
  {
    id: "logic-transport",
    name: "Logic Pro Transport",
    description:
      "Play/Pause, Record, Rewind, Forward, Return to start, and Cycle - matches the layer already verified on real hardware.",
    buttons: [
      { label: "Play", color: "#2a9d8f", iconGlyph: "play", action: { type: "key", usage: 44, modifiers: [] } },
      { label: "Record", color: "#e76f51", iconGlyph: "record", action: { type: "key", usage: 21, modifiers: [] } },
      { label: "Rewind", color: "#264653", iconGlyph: "rewind", action: { type: "key", usage: 54, modifiers: [] } },
      { label: "Forward", color: "#264653", iconGlyph: "forward", action: { type: "key", usage: 55, modifiers: [] } },
      { label: "To Start", color: "#457b9d", iconGlyph: "toStart", action: { type: "key", usage: 40, modifiers: [] } },
      { label: "Cycle", color: "#e9c46a", iconGlyph: "cycle", action: { type: "key", usage: 6, modifiers: [] } },
    ],
  },
  {
    id: "protools-transport",
    name: "Pro Tools Transport",
    description:
      "Play/Stop, Record, Rewind, Fast Forward, Return to Start, and Save - uses keys that behave the same in both of Pro Tools' selectable numeric-keypad modes.",
    buttons: [
      { label: "Play", color: "#2a9d8f", iconGlyph: "play", action: { type: "key", usage: 44, modifiers: [] } },
      { label: "Record", color: "#e76f51", iconGlyph: "record", action: { type: "key", usage: 69, modifiers: [] } },
      { label: "Rewind", color: "#264653", iconGlyph: "rewind", action: { type: "key", usage: 89, modifiers: [] } },
      { label: "Fwd", color: "#264653", iconGlyph: "forward", action: { type: "key", usage: 90, modifiers: [] } },
      { label: "To Start", color: "#457b9d", iconGlyph: "toStart", action: { type: "key", usage: 40, modifiers: [] } },
      { label: "Save", color: "#e9c46a", iconGlyph: "save", action: { type: "key", usage: 22, modifiers: ["ctrl"] } },
    ],
  },
  {
    id: "ableton-transport",
    name: "Ableton Live Transport",
    description:
      "Play/Stop, Restart, Record, and Undo use Ableton's own defaults. Metronome and Tap Tempo have no Ableton default - map them in Key Map Mode first.",
    buttons: [
      { label: "Play", color: "#2a9d8f", iconGlyph: "play", action: { type: "key", usage: 44, modifiers: [] } },
      { label: "Restart", color: "#264653", iconGlyph: "restart", action: { type: "key", usage: 44, modifiers: ["shift"] } },
      { label: "Record", color: "#e76f51", iconGlyph: "record", action: { type: "key", usage: 66, modifiers: [] } },
      { label: "Undo", color: "#457b9d", iconGlyph: "undo", action: { type: "key", usage: 29, modifiers: ["gui"] } },
      {
        label: "Metronome",
        color: "#e9c46a",
        iconGlyph: "metronome",
        action: { type: "key", usage: 16, modifiers: ["ctrl"] },
        requiresSetup: true,
        setupNote: "Ableton has no default Metronome shortcut - map this key in Key Map Mode (Cmd/Ctrl+K) first.",
      },
      {
        label: "Tap Tempo",
        color: "#e9c46a",
        iconGlyph: "tapTempo",
        action: { type: "key", usage: 23, modifiers: ["ctrl"] },
        requiresSetup: true,
        setupNote: "Ableton has no default Tap Tempo shortcut - map this key in Key Map Mode (Cmd/Ctrl+K) first.",
      },
    ],
  },
  {
    id: "obs-scene-control",
    name: "OBS Studio Scene Control",
    description:
      "Stream, Record, Mute Mic, and three scene switches. OBS ships with no default global hotkeys at all - assign every one of these in OBS's Settings > Hotkeys first.",
    buttons: [
      {
        label: "Stream",
        color: "#e76f51",
        iconGlyph: "stream",
        action: { type: "key", usage: 58, modifiers: ["ctrl"] },
        requiresSetup: true,
        setupNote: "Assign this key to Start/Stop Streaming in OBS's Settings > Hotkeys.",
      },
      {
        label: "Record",
        color: "#e76f51",
        iconGlyph: "record",
        action: { type: "key", usage: 59, modifiers: ["ctrl"] },
        requiresSetup: true,
        setupNote: "Assign this key to Start/Stop Recording in OBS's Settings > Hotkeys.",
      },
      {
        label: "Mute Mic",
        color: "#264653",
        iconGlyph: "mute",
        action: { type: "key", usage: 60, modifiers: ["ctrl"] },
        requiresSetup: true,
        setupNote: "Assign this key to Mute your mic source in OBS's Settings > Hotkeys.",
      },
      {
        label: "Scene 1",
        color: "#457b9d",
        iconGlyph: "scene",
        action: { type: "key", usage: 62, modifiers: ["ctrl"] },
        requiresSetup: true,
        setupNote: "Assign this key to switch to Scene 1 in OBS's Settings > Hotkeys.",
      },
      {
        label: "Scene 2",
        color: "#457b9d",
        iconGlyph: "scene",
        action: { type: "key", usage: 63, modifiers: ["ctrl"] },
        requiresSetup: true,
        setupNote: "Assign this key to switch to Scene 2 in OBS's Settings > Hotkeys.",
      },
      {
        label: "Scene 3",
        color: "#457b9d",
        iconGlyph: "scene",
        action: { type: "key", usage: 64, modifiers: ["ctrl"] },
        requiresSetup: true,
        setupNote: "Assign this key to switch to Scene 3 in OBS's Settings > Hotkeys.",
      },
    ],
  },
  {
    id: "media-controls",
    name: "Media Controls",
    description:
      "Play/Pause, Next, Previous, Volume Up/Down, and Mute - OS-level media keys that work regardless of which app has focus.",
    buttons: [
      { label: "Play", color: "#2a9d8f", iconGlyph: "play", action: { type: "media", key: "play_pause" } },
      { label: "Next", color: "#264653", iconGlyph: "skipNext", action: { type: "media", key: "next" } },
      { label: "Prev", color: "#264653", iconGlyph: "toStart", action: { type: "media", key: "prev" } },
      { label: "Vol +", color: "#457b9d", iconGlyph: "volumeUp", action: { type: "media", key: "vol_up" } },
      { label: "Vol -", color: "#457b9d", iconGlyph: "volumeDown", action: { type: "media", key: "vol_down" } },
      { label: "Mute", color: "#e76f51", iconGlyph: "mute", action: { type: "media", key: "mute" } },
    ],
  },
  {
    id: "logic-tools",
    name: "Logic Pro Tools Palette",
    description:
      "Six of Logic's Tool Menu shortcuts (Pointer, Pencil, Eraser, Scissors, Marquee, Mute) - sourced directly from a real Logic Pro Tool Menu.",
    buttons: [
      { label: "Pointer", color: "#2a9d8f", iconGlyph: "pointer", action: { type: "key", usage: 23, modifiers: [] } },
      { label: "Pencil", color: "#264653", iconGlyph: "pencil", action: { type: "key", usage: 19, modifiers: [] } },
      { label: "Eraser", color: "#e76f51", iconGlyph: "eraser", action: { type: "key", usage: 8, modifiers: [] } },
      { label: "Scissors", color: "#e9c46a", iconGlyph: "scissors", action: { type: "key", usage: 12, modifiers: [] } },
      { label: "Marquee", color: "#457b9d", iconGlyph: "marquee", action: { type: "key", usage: 21, modifiers: [] } },
      { label: "Mute", color: "#e76f51", iconGlyph: "mute", action: { type: "key", usage: 16, modifiers: [] } },
    ],
  },
  {
    id: "davinci-resolve-edit",
    name: "DaVinci Resolve Edit",
    description:
      "J/K/L shuttle, Mark In/Out, and Split at Playhead - DaVinci Resolve's standard editing shortcuts (J/K/L is shared with Premiere and Avid).",
    buttons: [
      { label: "Rewind", color: "#264653", iconGlyph: "rewind", action: { type: "key", usage: 13, modifiers: [] } },
      { label: "Stop", color: "#e76f51", iconGlyph: "stop", action: { type: "key", usage: 14, modifiers: [] } },
      { label: "Play", color: "#2a9d8f", iconGlyph: "play", action: { type: "key", usage: 15, modifiers: [] } },
      { label: "Mark In", color: "#457b9d", iconGlyph: "markIn", action: { type: "key", usage: 12, modifiers: [] } },
      { label: "Mark Out", color: "#457b9d", iconGlyph: "markOut", action: { type: "key", usage: 18, modifiers: [] } },
      { label: "Split", color: "#e9c46a", iconGlyph: "split", action: { type: "key", usage: 5, modifiers: ["gui"] } },
    ],
  },
  {
    id: "app-launcher",
    name: "App Launcher",
    description:
      "Six generic hotkeys (Ctrl+Alt+1..6) for launching apps of your choice. The device can only ever send a keystroke - it cannot launch an app directly, so every button here needs to be bound to an actual app launch using an OS-level tool (Hammerspoon, Keyboard Maestro, AutoHotkey, etc).",
    buttons: [1, 2, 3, 4, 5, 6].map((n) => ({
      label: `App ${n}`,
      color: "#6c757d",
      iconGlyph: "appLauncher",
      action: { type: "key", usage: 29 + n, modifiers: ["ctrl", "alt"] },
      requiresSetup: true,
      setupNote: `Bind Ctrl+Alt+${n} to launch an app of your choice, using a hotkey tool like Hammerspoon, Keyboard Maestro, or AutoHotkey.`,
    })),
  },
];

// Pure function: builds a new layer object from a template, for the given
// layer id. Strips requiresSetup/setupNote/iconGlyph from every button - the
// result is exactly the same shape a hand-built layer would have.
// iconGlyph is deliberately NOT turned into a real `icon` id here - that
// requires Canvas (glyphs.js's generateGlyphIcon), which this file stays
// free of so it can keep being unit-tested without a browser; the editor
// does that conversion when it actually applies a template.
export function applyTemplate(template, layerId) {
  const buttons = new Array(BUTTONS_PER_LAYER).fill(null);
  template.buttons.forEach((slot, index) => {
    if (!slot) return;
    const { requiresSetup, setupNote, iconGlyph, ...plain } = slot;
    buttons[index] = plain;
  });
  return { id: layerId, buttons };
}

export function findTemplate(templateId) {
  return TEMPLATES.find((t) => t.id === templateId) || null;
}
