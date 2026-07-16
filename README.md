# Streamdeck CYD

A Stream Deck-style macro pad built on a "CYD" (Cheap Yellow Display,
ESP32-2432S028R) board: six configurable buttons on the touchscreen, editable
from a browser, connecting to your computer over Bluetooth as a plain
keyboard/media-key device.

See `openspec/changes/add-macropad-mvp/` for the full proposal, design, and
specs this implementation follows.

## What it is (and isn't)

- The device shows six buttons at a time. A button either sends a keystroke
  or media key (play/pause, volume, etc.), or opens a nested "layer" of six
  more buttons - like folders.
- It connects over **Bluetooth Low Energy only** - there's no wired USB HID
  and no companion app running on your computer. "Launching an app" means
  the device sends a keystroke; you bind that keystroke to a real action
  using tools already on your OS (see [Binding keys to real actions](#binding-keys-to-real-actions)
  below).
- Configuration (which buttons do what, and the layer tree) is edited from a
  webapp in your browser, pushed to the device over **Web Bluetooth** - no
  WiFi setup, no companion app, no device-hosted web server. This only works
  in Chromium-based browsers (Chrome, Edge, Android Chrome) - Web Bluetooth
  isn't supported in Safari or Firefox.

## Flashing via bmorcelli Launcher

1. Install [bmorcelli Launcher](https://github.com/bmorcelli/Launcher) on
   your ESP32-2432S028R if it isn't already, following its own instructions.
2. Grab the latest `streamdeck-cyd-*.bin` from this repo's
   [Releases](../../releases) page (built by `.github/workflows/firmware-release.yml`).
3. In Launcher's WebUI (or via its SD card install flow), upload the `.bin`
   as a new app and launch it.
4. On first boot with no configuration yet, the device shows a small
   built-in default layout (a Play/Pause button and a Copy shortcut) so you
   have something to touch immediately.

## Connecting the webapp

1. Open the webapp (hosted via GitHub Pages once `.github/workflows/pages.yml`
   has deployed it, or open `webapp/index.html` locally in Chrome/Edge).
2. Click **Connect over Bluetooth** and pick your device from the browser's
   chooser. The webapp pulls the device's current configuration
   automatically.
3. Edit layers and buttons, then click **Push to device**. The webapp will
   tell you whether the device actually applied the change - a successful
   push isn't just "the bytes were sent," it's the device confirming it
   parsed and accepted the new configuration.

### Editing layers and buttons

- Each layer has six slots, shown as a 3x2 grid. Click a slot to edit its
  label, color, and action.
- An action is one of:
  - **key** - a keystroke (HID usage code + modifiers like ctrl/shift/alt/gui)
  - **media** - a media key (play/pause, next, previous, volume up/down, mute)
  - **layer** - jump into another layer (create one first with **+ New layer**)
- On the device, a full-width "< Back" bar appears along the bottom of the
  screen whenever you're not on the root layer, to navigate back up.
- **Clear slot** empties a button. **Delete this layer** removes a non-root
  layer, but is blocked if any button elsewhere still points at it - you'll
  see which button(s) are referencing it.

### Icon buttons

A slot can show a small image instead of (or alongside, as a background
under the label) its flat color:

- Click **Upload icon** in the slot editor and pick any image file. The
  webapp crops/resizes it to a fixed 64x64 bitmap and shows a preview right
  in that slot's grid cell - no need to push to the device first to see it.
- **Clear icon** removes just the image, leaving the slot's label, color,
  and action untouched.
- Uploading the same image for two different slots stores and transfers the
  bitmap once (icons are identified by a content hash of the converted
  bitmap, not by slot) - pushing a config that reuses an icon doesn't
  re-upload it.
- Icons are recovery-scoped, not reference-counted: deleting or reassigning
  a slot's icon doesn't delete the underlying bitmap file from the device.
  At a fixed 8192 bytes/icon this is a deliberate simplicity trade-off (see
  `openspec/changes/add-image-buttons/design.md`'s non-goals) - a stray
  unreferenced icon file is harmless at the scale this device operates at.
- If a slot's icon can't be loaded on-device (never uploaded, or the file's
  gone), it just falls back to the plain color fill - never a broken image.

### Layer templates

Instead of building a layer button-by-button, click **+ From template** to
create one pre-populated from a built-in preset. Eight ship today:

- **Logic Pro Transport** - verified working on real hardware: Play/Pause,
  Record, Rewind, Forward, Return to start, Cycle.
- **Pro Tools Transport** - Play/Stop, Record, Rewind, Fast Forward, Return
  to Start, Save, using keys that work the same in both of Pro Tools'
  selectable numeric-keypad modes.
- **Ableton Live Transport** - Play/Stop, Restart, Record, and Undo match
  Ableton's own defaults. **Metronome and Tap Tempo need setup**: Ableton
  has no default shortcut for either, so you'll need to map the picker's
  suggested key combo in Ableton's Key Map Mode (Cmd/Ctrl+K) before those
  two buttons do anything.
- **OBS Studio Scene Control** - Stream, Record, Mute Mic, and three scene
  switches. **All six buttons need setup**: OBS ships with no default
  global hotkeys at all, so every one of these is a suggested key
  combination you must assign to the matching action yourself, in OBS's
  Settings > Hotkeys, before the layer does anything.
- **Media Controls** - Play/Pause, Next, Previous, Volume Up/Down, Mute.
  OS-level media keys, not app shortcuts - work regardless of which app has
  focus, no setup needed.
- **Logic Pro Tools Palette** - Pointer, Pencil, Eraser, Scissors, Marquee,
  Mute, sourced directly from a real Logic Pro Tool Menu.
- **DaVinci Resolve Edit** - the J/K/L shuttle keys, Mark In/Out, and Split
  at Playhead - DaVinci Resolve's standard editing shortcuts (J/K/L is
  shared with Premiere and Avid, not unique to Resolve).
- **App Launcher** - six generic "App 1"-"App 6" buttons sending
  Ctrl+Alt+1 through Ctrl+Alt+6. **Every button needs setup**: the device
  can only ever send a keystroke, it can't launch an application directly,
  so you bind each one to actually launching an app using an OS-level
  hotkey tool (Hammerspoon, Keyboard Maestro, AutoHotkey, etc).

The template picker shows which buttons need this kind of setup before you
create the layer. Once created, a template-based layer is a normal layer -
edit, clear, or delete its buttons exactly as you would a hand-built one.

Every template button also comes with a small built-in icon (a play
triangle, record dot, scissors, etc.) - procedurally drawn, not a real
image file, so there's no external asset or logo involved. These are
generated and stored exactly like an uploaded icon (see "Icon buttons"
above), so you can replace any of them with your own image, or clear them,
the same way you would on a hand-built button.

### Backing up and moving a config to a new device

**Download backup** and **Restore backup** (in the header, next to Connect/Push)
export and import your full configuration - every layer, button, and icon
bitmap - as a single JSON file you save on your computer:

- Click **Download backup** any time (connected to a device or not) to save the
  currently-loaded configuration to a file.
- Click **Restore backup** and pick a previously-downloaded file to load it back
  into the editor - no device needs to be connected to do this, so you can
  review or tweak a backup before pushing it anywhere.
- Once restored, click **Push to device** as usual. This works exactly the same
  whether you're pushing back to the original device or a brand-new one: any
  icon the connected device doesn't already have gets uploaded automatically
  before the configuration itself is pushed - so restoring onto new hardware
  "just works" through the same push flow you'd use for any other edit.

This is different from the SD-card backup described below: that one protects a
single device against its own internal storage getting corrupted or wiped.
Download/Restore backup is what actually gets a working layout onto a
*different* piece of hardware.

## Binding keys to real actions

Since the device only ever sends keystrokes/media keys - never "launch app
X" directly - you bind the keystroke it sends to whatever you actually want
to happen, using tools already available on your OS:

- **macOS - Shortcuts / Automator**: create a Quick Action or Shortcut bound
  to a keyboard shortcut, then set that as the button's `key` action. Or use
  [Hammerspoon](https://www.hammerspoon.org/) for more power (launch apps,
  run Lua, etc.) bound to a hotkey.
- **Windows - PowerToys**: use PowerToys' Keyboard Manager or a shortcut
  runner to bind a key combo to launching an app or running a script.
- **Windows/macOS/Linux - AutoHotkey / [Hammerspoon]**: bind the exact key
  combo the button sends to a script that does anything you want.
- **Media keys** (`play_pause`, `next`, `prev`, `vol_up`, `vol_down`, `mute`)
  are handled natively by the OS/whatever media app has focus - no extra
  setup needed for those.

## Development

### Firmware

```
pio test -e native          # pure-logic unit tests (config validation, chunk framing) - no hardware needed
pio run -e esp32-2432S028R  # build the real firmware
```

### Webapp

```
cd webapp
npm test   # pure-logic unit tests (validation, BLE chunk framing) - no browser needed
```

Open `webapp/index.html` directly in Chrome/Edge to try the editor UI; it
needs a real device nearby to actually connect.

## Known open items

- Core operation is confirmed on real ESP32-2432S028R hardware: BLE HID
  pairing, key/media action delivery, multi-layer navigation, and pushing
  config from the webapp all work end to end (see
  `openspec/changes/archive/2026-07-15-add-macropad-mvp/` for the full
  history, including two real bugs found and fixed during bring-up - a
  shared-BLE-server bug and a crash loop - documented in that change's
  `design.md`).
- Whether reinstalling firmware through bmorcelli Launcher preserves or
  wipes the device's stored configuration still hasn't been confirmed on
  real hardware. An SD-card backup/recovery mechanism (mirror config to an
  SD card, restore from it if internal storage is missing/invalid) is
  implemented in code - see `openspec/changes/add-sd-config-backup/` - but
  the SD card's CS pin (assumed GPIO5) and its SPI bus sharing with the TFT
  are still unverified against the physical unit.
- Image/icon buttons (a button showing a small bitmap instead of its color)
  are implemented end to end - firmware storage/rendering, BLE transfer,
  and the webapp's upload/preview/clear UI - see
  `openspec/changes/add-image-buttons/`. Not yet verified on real hardware:
  the RGB565 byte order between the webapp's conversion and what
  `pushImage()` expects on-device is an explicit, documented guess
  (`tft.setSwapBytes(true)` paired with big-endian byte packing) pending an
  early hardware check before relying on it further.
- Pin mappings, touch calibration constants, and BLE notification pacing in
  the firmware are based on commonly documented values for this board and
  library defaults - most are now confirmed correct by the working hardware
  above, but touch calibration specifically hasn't been fine-tuned yet (see
  the comments in `src/display/DisplayManager.cpp`).

## License

MIT - see [LICENSE](LICENSE).
