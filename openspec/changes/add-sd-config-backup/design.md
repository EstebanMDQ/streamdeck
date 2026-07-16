## Context

`macropad-config-storage` today persists the active configuration to LittleFS only.
Whether reinstalling firmware through bmorcelli Launcher preserves or wipes that
LittleFS partition has never been confirmed on real hardware. The board's microSD
slot is present but unused. This change adds it as a backup/recovery path, building
on `src/storage/ConfigStorage.*` and the existing `parseAndValidate`/`serialize`
functions in `lib/macropad_config` (unchanged - reused as-is for the SD copy).

## Goals / Non-Goals

**Goals:**
- Survive a LittleFS wipe (from a Launcher reinstall or otherwise) without losing the
  user's configuration, as long as an SD card was inserted at the time of the last
  successful config push.
- Never make the SD card a dependency for normal operation - the device must work
  identically with no card inserted.

**Non-Goals:**
- User-editable SD config (hand-authoring/editing the SD file directly) - this is a
  recovery mechanism, not an alternate authoring path. Revisit as a separate change if
  wanted later.
- Detecting or reacting to a card being hot-swapped mid-session beyond simple
  mount-attempt-per-operation (see Decisions).

## Decisions

### Mount SD on-demand per operation, not once at boot
`SD.begin(kSdCsPin)` is called immediately before a backup write or a boot-time
restore read, and `SD.end()` immediately after, rather than holding the SD peripheral
initialized for the device's whole lifetime. Rationale: SD and the TFT share the same
SPI bus (different CS pins only), and this keeps SD's use of that bus strictly
bounded to the moments it's actually needed, minimizing any chance of contention with
TFT/touch rendering. It also means a card inserted after boot is picked up on the next
config push rather than requiring a reboot.
- Pin: `SD_CS = GPIO5`, per the commonly documented ESP32-2432S028R pin map (shares
  the TFT's SPI bus - MISO 12/MOSI 13/SCK 14 - with its own CS). Verify against the
  physical unit during bring-up, same caveat as the other pin assumptions in
  `add-macropad-mvp`'s design.md.

### Reuse the existing JSON schema and validation, no new format
The SD backup is byte-for-byte the same JSON `macropad_config::serialize()` already
produces for LittleFS, at a fixed path (`/streamdeck-config.json` on the SD card's
root), validated on read with the same `parseAndValidate()` used for BLE pushes and
LittleFS loads. No new pure logic to write or unit-test here - this change is
entirely I/O sequencing (when to read/write which storage in what order), layered on
already-tested validation.

### Cap the SD backup file's read size before allocating a buffer for it
Unlike the internal LittleFS config file (which only ever contains what this
firmware itself wrote), the SD backup file is explicitly the thing this feature
expects might be garbage - a leftover file from a different card/device, a
corrupted write, or coincidence. Before reading it into memory, `loadFromSdIfValid()`
SHALL check the file's size and refuse to read (equivalent to "invalid") anything
larger than a fixed cap (64KB - generously larger than any realistic configuration,
which is currently a handful of KB at most). This exists specifically so a
foreign/oversized file at that path can't cause a large or failing heap allocation on
the ESP32's constrained RAM, on the exact recovery code path that most needs to not
crash. Found during proposal review - the original draft reused the existing
unbounded read-into-`std::string` pattern from `ConfigStorage::load()`'s internal
path, which is safe there (only ever reads back what this firmware wrote) but isn't
safe for a source explicitly expected to sometimes be untrusted/foreign.

### SD writes are atomic, reusing the same temp-file-then-rename pattern as LittleFS
The SD backup write uses the identical atomicity pattern already implemented for the
internal LittleFS save (write to a temp filename, then rename over the real one) -
the SD library supports the same operations. Found during proposal review: without
this, a power loss mid-SD-write could leave a truncated/corrupt backup file that
silently fails validation later - which would defeat recovery at exactly the moment
(internal storage wiped, SD relied upon) this whole feature exists for. A corrupt SD
file still fails safe (rejected by `parseAndValidate()`, falls through to the
hardcoded default per the three-tier requirement) even without this, but atomicity
means a single power loss during a backup write can't create that corrupt file in
the first place.

### Backup is best-effort and never blocks the internal apply path
`ConfigStorage::save()` (called after a BLE push is validated) persists to LittleFS
first, exactly as today, and only then attempts the SD mirror. If SD mount, write, or
unmount fails for any reason, the function still reports success for the internal
save - the caller (and `ConfigStatus.lastApplyResult`) is unaffected by SD backup
outcome. This matches the existing `macropad-ble-config-protocol` contract, which
doesn't need to change.

### Three-tier boot recovery, self-healing
`ConfigStorage::load()` becomes: try internal LittleFS (as today) -> if missing or
invalid, try the SD backup file, validating it the same way -> if that's also
missing/invalid, or no card is present, fall back to the existing hardcoded default.
If the SD backup is used, it's immediately re-persisted to LittleFS, so a single SD
recovery heals internal storage for subsequent boots without needing the card present
every time.

## Risks / Trade-offs

- **SD card wiring/pin assumption unverified on real hardware** → mitigate with an
  explicit hardware bring-up task (mirroring how `add-macropad-mvp` handled its own
  unverified pin assumptions) before trusting this in practice.
- **Shared SPI bus with TFT/touch** → mitigate via the on-demand mount/unmount
  decision above, bounding SD's bus usage to short, infrequent windows.
- **Silent SD failures could mask a real problem (e.g. a corrupt/full card) from the
  user** → acceptable for this change: the feature is explicitly "nice to have"
  insurance, not a guarantee, and surfacing SD-specific errors to the user would need
  a new UI affordance out of scope here. A debug-level log line on failure (already
  the codebase's pattern for non-fatal storage issues) is sufficient.
