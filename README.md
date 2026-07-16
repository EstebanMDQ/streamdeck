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
- On the device, a small back affordance appears in the top-left corner
  whenever you're not on the root layer, to navigate back up.
- **Clear slot** empties a button. **Delete this layer** removes a non-root
  layer, but is blocked if any button elsewhere still points at it - you'll
  see which button(s) are referencing it.

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

- The firmware builds cleanly for the real target (`pio run -e esp32-2432S028R`
  succeeds, 59.4% flash / 12.3% RAM used) and all pure-logic unit tests pass,
  but it hasn't been flashed to or run on physical hardware yet - see
  `openspec/changes/add-macropad-mvp/tasks.md` for exactly which tasks are
  implementation-complete vs. still needing a real device.
- Whether reinstalling firmware through bmorcelli Launcher preserves or
  wipes the device's stored configuration hasn't been confirmed on real
  hardware yet (see `tasks.md`, section 2). An SD-card backup/recovery
  mechanism was designed as a mitigation but deferred to a later phase - see
  `design.md`'s non-goals.
- Image/icon buttons are a documented phase-2 idea (`openspec/config.yaml`),
  not implemented here - v1 buttons are label + color only.
- Pin mappings, touch calibration constants, and BLE notification pacing in
  the firmware are based on commonly documented values for this board and
  library defaults, not yet verified against physical hardware - see the
  comments in `src/display/DisplayManager.cpp` and
  `src/ble/ConfigService.cpp`, and `tasks.md`'s hardware-verification tasks.

## License

MIT - see [LICENSE](LICENSE).
