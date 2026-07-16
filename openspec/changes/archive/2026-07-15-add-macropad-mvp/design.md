## Context

First implementation for the project (see `proposal.md`). No existing code or specs
to build on. The design needs to nail down: the on-device data model, the BLE GATT
config protocol (since it's custom, not an existing pattern to reuse), how HID actions
are represented, storage format/durability, and enough of the webapp/firmware
packaging shape that the capability specs and task breakdown aren't guessing.

## Goals / Non-Goals

**Goals:**
- A config format and GATT protocol simple enough to implement on both an ESP32 (C++)
  and a browser (JS) without a shared codebase or code generation step.
- A layer/button model that supports arbitrary nesting depth even though only one
  6-button grid is shown at a time.
- Config that survives power loss and reboots without the webapp ever being connected
  again.
- A firmware artifact that bmorcelli Launcher can install without any special
  cooperation from Launcher itself.

**Non-Goals:**
- OTA firmware updates, or pushing firmware through the BLE config channel.
- Real-time/live sync between webapp and device - config is only exchanged when
  explicitly connected and pushed/pulled.
- Icons/images, multiple boards, wired USB HID, or a host companion app (see
  proposal - these are out of scope for this change entirely).
- SD card configuration backup/recovery - considered and designed, but deferred to a
  later phase as a nice-to-have, not required for v1.
- Image/icon buttons - phase 2 candidate. Likely approach when it's designed: the
  webapp converts an uploaded image client-side (canvas resize + color reduction)
  into a small fixed-size raw bitmap in the exact pixel format the device expects
  (e.g. RGB565), so firmware only ever blits raw bytes and never needs a PNG/JPEG
  decoder on-device. Not designed further here - depends on capabilities this change
  introduces, so it needs its own change once this one is implemented and archived.

## Decisions

### Config schema: JSON, single blob, versioned
The full config (all layers/buttons) is one JSON document, e.g.:
```json
{
  "schemaVersion": 1,
  "rootLayer": "root",
  "layers": {
    "root": {
      "buttons": [
        {"label": "Copy", "color": "#264653", "action": {"type": "key", "usage": 6, "modifiers": ["ctrl"]}},
        {"label": "Play", "color": "#2a9d8f", "action": {"type": "media", "key": "play_pause"}},
        {"label": "Edit", "color": "#e76f51", "action": {"type": "layer", "target": "edit-layer"}},
        null, null, null
      ]
    },
    "edit-layer": { "buttons": [ /* up to 6 */ ] }
  }
}
```
- `action.type` is one of `"key"`, `"media"`, or `"layer"`, each with a normative
  field shape (this is the contract between the independently-built firmware and
  webapp, not just an illustration):
  - `"key"`: `usage` is an integer USB HID keyboard usage ID (e.g. `4` = 'a', `6` =
    'c'), and `modifiers` is an array drawn only from `["ctrl", "shift", "alt",
    "gui"]` (left-hand modifiers only for v1, no left/right distinction).
  - `"media"`: `key` is one of the fixed consumer-control vocabulary `play_pause`,
    `next`, `prev`, `vol_up`, `vol_down`, `mute`.
  - `"layer"`: `target` is a string layer id referencing another layer.
- Unused button slots are `null` (rendered empty, non-interactive).
- `schemaVersion` lets firmware and webapp detect drift and refuse/upgrade instead of
  silently misinterpreting fields.
- Validation on-device is both syntactic and structural: valid JSON and a supported
  `schemaVersion` are necessary but not sufficient. Firmware also rejects a payload
  where any layer doesn't have exactly six slots, any `action.type` isn't one of the
  three valid values, or any `media.key` isn't in the fixed vocabulary - a
  syntactically-valid-but-wrong-shape payload would otherwise be parsed into
  fixed-size embedded structures, which is a crash/undefined-behavior risk. Whether a
  `layer` action's `target` actually exists is checked by the webapp editor before
  push (see `webapp-layer-editor`), not re-verified on-device, keeping the embedded
  check bounded to type/shape safety rather than full graph validation.
- Alternative considered: a compact binary/TLV format. Rejected for v1 - JSON is
  trivial to produce in the browser and parse with a small ESP32 JSON library
  (ArduinoJson), and the config is small (a handful of layers/buttons), so size isn't
  a real constraint yet.

### Layer navigation: dedicated back affordance outside the 6 button slots
All 6 slots in every layer are available for real actions (including further layer
links), so "back" is not one of the 6 buttons. Instead the display reserves a small
persistent affordance (e.g. a corner tab) that appears only when the current layer
isn't root and pops one level up. This keeps the mental model simple: any button can
be a launcher or a folder, and there's always one consistent way back.
- Alternative considered: reserve button slot 6 as an implicit "back" whenever not on
  the root layer. Rejected - it silently reduces nested layers to 5 usable buttons,
  which is surprising and inconsistent between root and non-root layers.

**Revised after real-device testing**: the first implementation used a small
32x32px corner square, which testing on real hardware found very hard to hit
reliably - a small target compounded by resistive touch being least accurate
near corners, and touch calibration constants that are still placeholder
values (not yet tuned to the physical unit). Replaced with a full-width bar
along the bottom of the screen (`kBackBarHeight = 40`), reserved consistently
across every layer (not just non-root ones) so button cell sizing never
changes depending on which layer is shown.

### BLE: two custom services, both required, sharing one BLEServer
1. **HID service**: standard BLE HID-over-GATT profile, implemented directly
   against this project's framework's own `BLEHIDDevice`/`BLEServer` APIs (see
   "Own BLE HID implementation" below for why, not a third-party wrapper
   library). Pairs the device as a keyboard/consumer-control peripheral.
2. **Config service** (custom UUID): a small application-level chunked-transfer
   protocol over 3 characteristics:
   - `ConfigTransfer` (write **with response**): client sends chunks, each prefixed
     with `[uint16 totalLength][uint16 offset][payload]`. Device buffers until
     `offset + len(payload) == totalLength`, then validates and parses. Using
     write-with-response (not write-without-response) means each chunk is acked at
     the ATT layer, so the client knows a chunk actually arrived before sending the
     next one - an earlier write-without-response design gave no delivery
     confirmation at all. Only one transfer may be in flight at a time; a disconnect,
     a new transfer starting, or ~15s of inactivity mid-transfer discards the
     buffered partial payload so stale bytes can't corrupt a later push.
   - `ConfigDump` (read + notify): device streams the current config out the same way
     (notify chunks with the same framing) when the client subscribes/requests it, so
     the webapp can pull existing config before editing.
   - `ConfigStatus` (read + notify): firmware version, the `schemaVersion` it
     supports, and `lastApplyResult` - one of `none | applied | rejected_invalid_json
     | rejected_schema_version | rejected_structure` - set once the most recently
     completed `ConfigTransfer` has been parsed and validated (or rejected). Chunk
     delivery being acked (write-with-response) is not the same as the payload being
     applied, so the webapp reads/subscribes to `ConfigStatus` after the final chunk
     to learn the actual outcome instead of assuming success.
   - Rationale for app-level chunking over relying on GATT "long read/write" queued
     PDUs: behavior of long attribute reads/writes varies across BLE stacks
     (NimBLE/Bluedroid) and isn't reliably exposed the same way through the Web
     Bluetooth API, so an explicit length/offset framing that both sides implement
     identically is more predictable than depending on stack-level chunking.

**Discovered during hardware bring-up**: the config service's UUID cannot also
be advertised in the BLE advertising packet alongside the HID service's UUID.
Checked against the actual installed `BLEAdvertising::start()` source: every
advertised service UUID is expanded to a full 128-bit (16-byte) entry
regardless of its original width, so HID's UUID (16 bytes once expanded) plus
this service's own 128-bit UUID (16 bytes) is 32 bytes of service-UUID data
alone - already over the 31-byte cap on a single legacy BLE advertising
packet, before Flags/Appearance/name are added. `ConfigService::begin()`
intentionally does not call `addServiceUUID()`/re-advertise for its own
service because of this.

The webapp initially filtered Web Bluetooth's device chooser by advertised
**name** (`namePrefix: "Streamdeck"`) instead, since HID's advertising
reliably includes the name. That, too, turned out to be unreliable in
practice: during hardware bring-up this device's name showed up stale
("CYD MIDI", a name from earlier unrelated testing) in *multiple*
independent tools against the same physical device - macOS's Bluetooth
Settings, a raw `bleak`/CoreBluetooth scan, and apparently Chrome's own Web
Bluetooth chooser too - strongly suggesting host-OS-level BLE identity
caching (keyed by the device's stable MAC-derived address) rather than
anything wrong with the advertisement itself. Since no filter proved
reliable, `connect()` now uses `acceptAllDevices: true` - the chooser shows
every nearby device and the user picks theirs visually (already proven to
work: this is exactly how pairing was completed via macOS's own Bluetooth
Settings once "CYD MIDI" was recognized as the same device by its
HID-service-UUID advertisement, not by name) - and still lists the config
service as `optionalServices` so it's reachable once connected regardless
of what name/UUIDs the chooser displayed.

### Own BLE HID implementation, not a third-party wrapper library
The first hardware build used T-vK's `ESP32-BLE-Keyboard` library for the HID
service, with `ConfigService` creating its own second `BLEServer` for the
config service (reasoned at the time to be safe, since `BLEServer::createApp()`
registers each server as an independent GATT application). On real hardware,
this device advertised and showed a working splash screen, but never became
pairable/connectable. Reading `BLEDevice.cpp` traced this to a real bug: this
framework's `BLEDevice::gattServerEventHandler` (the single global dispatcher
for every GATT server event - connect, disconnect, characteristic writes)
routes exclusively through one static `BLEDevice::m_pServer` pointer, which
`BLEDevice::createServer()` **overwrites** on every call. Once `ConfigService`
created its own server, `BLEDevice::m_pServer` pointed at it instead of the
original HID server - so the HID server's `onConnect`/`onDisconnect`
(and its `m_connectedCount`) silently stopped updating entirely, regardless of
what was actually happening at the radio level. There can only be one
"live" `BLEServer` in this framework; a second one doesn't run alongside the
first, it breaks it.

Fixing this properly requires both services to attach to the *same* server.
`ESP32-BLE-Keyboard` doesn't expose the `BLEServer*` it creates (no public
accessor, and it ships with no LICENSE file, so patching and vendoring a
modified copy was intentionally avoided rather than risk an unclear license
in this repo). Instead, `HidService` now implements the BLE HID keyboard and
consumer-control profile directly against this project's framework's own
`BLEHIDDevice`/`BLEServer` classes (Apache/MIT-licensed, already a direct
dependency via ConfigService) - written fresh against the public USB-IF HID
Usage Tables, not copied from any third-party library. `HidService` owns the
one `BLEServer` for the whole device and exposes it via `getServer()`;
`ConfigService::begin(server)` now takes that same server and attaches its
service to it, rather than creating its own.

**Second bug found on the very next flash**: the device then crash-looped
(visible as the idle screen "flashing" - actually a repeated
panic/reboot cycle, not a BLE issue at all). Serial output showed
`Guru Meditation Error: Core 1 panic'ed (LoadProhibited)` on every boot;
decoding the crash backtrace against the build's own `firmware.elf` with
`xtensa-esp32-elf-addr2line` pointed exactly at
`HidService::begin()`'s `gHid->manufacturer("DIY")` call. `BLEHIDDevice`'s
string-argument `manufacturer(std::string)` overload only writes through
`m_manufacturerCharacteristic` - it never creates it. That characteristic is
only created as a side effect of calling the *other*, no-argument
`manufacturer()` getter first. Calling the setter directly dereferences an
uninitialized pointer. Fixed by calling `gHid->manufacturer()->setValue(...)`
instead. Also switched the security mode from `ESP_LE_AUTH_REQ_SC_MITM_BOND`
to `ESP_LE_AUTH_REQ_SC_BOND` (Secure Connections + Bonding, no MITM) since
this device has no passkey-entry UI to satisfy an MITM requirement -
unrelated to the crash, but worth fixing at the same time since it could
have caused a similar-looking connect/disconnect loop once actual pairing
was attempted.

### Button press feedback and config swaps mid-navigation
Any press on a non-empty slot gives brief visual feedback (e.g. a short
highlight/invert) regardless of whether the underlying action was actually delivered
(no BLE HID host connected, etc.) - this gives the user a consistent "your tap
registered" signal without conflating it with delivery confirmation, which doesn't
exist for one-way HID reports anyway. Separately, if a new configuration is applied
while the currently displayed layer isn't the root layer, and that layer id doesn't
exist in the new configuration, the display resets to the new configuration's root
layer rather than showing a stale or undefined view.

### Idle screen while no BLE HID host is connected
Added after real hardware use surfaced that a user has no visual indicator of
whether the device is paired/connected or just sitting there advertising. The
display shows a simple idle/splash screen (device name + "waiting to
connect") whenever `HidService::isConnected()` is false, and switches to the
normal button grid once a host connects - reverting to the idle screen again
on disconnect. This only reflects the BLE HID connection (the one a user
pairs with day-to-day), not the separate, occasional config-service
connection from the webapp.

### Storage: LittleFS, single file, atomic write
Config lives at `/config.json` in LittleFS. Writes go to `/config.json.tmp` then
rename over the old file, so a power loss mid-write can't corrupt the active config.
On boot, if the file is missing, unparsable, or has an unsupported `schemaVersion`,
firmware falls back to a small hardcoded default (root layer with a couple of sample
buttons) rather than refusing to boot.

**Deferred to a later phase**: mirroring config to the SD card as a backup/recovery
source (so a firmware reflash that happens to wipe the LittleFS partition wouldn't
lose the config) was considered and designed, but is a nice-to-have, not needed for
v1. Revisit if/when reflashing is confirmed to actually wipe stored config in
practice.

### Firmware packaging: standalone PlatformIO app-only binary
Firmware is a normal PlatformIO/Arduino build targeting the ESP32-2432S028R pin map
(a known community board definition, not something we invent). CI builds the
app-partition `.bin` (not a merged bootloader+partition+app image) sized to fit in a
single OTA-app slot, since bmorcelli Launcher's partition manager allocates space per
installed app rather than expecting a fixed layout. This is validated by actually
installing the built binary through Launcher's WebUI during implementation, not just
inferred from Launcher's docs.

### Webapp: no build step, vanilla HTML/CSS/JS
Given the scope (one editor screen, no backend, no other API calls besides Web
Bluetooth), a bundler/framework isn't needed. Plain static files served directly from
GitHub Pages keep deployment to "push to the pages branch," matching "simple over
clever." This can be revisited if the editor UI grows enough to justify componentry.

### Test strategy: unit-test pure logic, verify hardware-dependent behavior manually
Automated tests are scoped to code that doesn't require real hardware or a real BLE
link:
- Firmware: config JSON parsing/structural validation (six-slot check, action-type
  enum, media-key vocabulary, schemaVersion handling) and the `ConfigTransfer`
  chunk-reassembly bookkeeping (offset/length framing, discard-on-new-transfer,
  discard-on-timeout) are both pure byte/data logic, run via PlatformIO's
  native/Unity test environment on the build host - no ESP32 or BLE radio needed.
- Webapp: the layer-tree validation the editor performs before allowing a push
  (every `layer` action's `target` exists; a layer can't be deleted while still
  referenced) is pure logic, run via a lightweight JS test runner (e.g. Node-based),
  no browser or Web Bluetooth needed.
- Display rendering, touch-to-slot mapping, BLE HID report delivery, and the Web
  Bluetooth connect/push/pull flow all depend on real hardware or a real browser
  and stay manual verification steps (as already reflected by the "Verify..." tasks
  in `tasks.md`), rather than being automated for v1.
- Alternative considered: scripted BLE/HID integration tests (real or simulated
  radio). Rejected for v1 - meaningfully more setup/maintenance for a hobby project,
  and the highest-value bugs (malformed config crashing the parser, a stale
  reassembly buffer corrupting a later push) are already caught by unit-testing the
  pure logic without needing a radio in the loop.

## Risks / Trade-offs

- **Web Bluetooth is Chromium-only** → mitigate by detecting `navigator.bluetooth`
  and showing a clear "use Chrome/Edge" banner instead of failing silently.
- **No companion app means keystrokes aren't literally "launching an app"** →
  mitigate with clear documentation/onboarding copy in the webapp pointing at
  Hammerspoon/AutoHotkey/PowerToys/Shortcuts examples for binding keys to actions.
- **Custom chunked BLE protocol instead of a standard one** → more code to write and
  test on both ends, but avoids depending on stack-specific long-read/write behavior
  that's hard to verify portably. Mitigate with a small fixed-size test config used to
  exercise multi-chunk transfer early in implementation.
- **bmorcelli Launcher's partition allocation is inferred from docs, not yet tested
  against our actual binary size** → mitigate by installing a real build through
  Launcher as an early implementation task, not deferred to the end.
- **Unconfirmed whether reinstalling firmware through Launcher preserves or wipes the
  LittleFS config partition** → accepted as a v1 risk (user just re-pushes config via
  the webapp if it happens); an SD card backup/recovery mechanism was designed as a
  mitigation but deferred to a later phase as a nice-to-have, not required for v1.
- **Config only changes when explicitly connected and pushed** → acceptable given the
  no-companion-app, no-OTA scope, but worth calling out so it isn't mistaken for a bug
  later (e.g. two people editing "the same" device's config from different laptops
  will silently overwrite each other - out of scope to solve here).
