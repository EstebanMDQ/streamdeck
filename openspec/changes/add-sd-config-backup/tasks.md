## 1. Firmware: SD card backup write

- [x] 1.1 Add the ESP32 Arduino core's `SD` library dependency to `platformio.ini` (SPI-based, shared bus with TFT/touch) - turned out to need no `lib_deps` entry at all; PlatformIO's Library Dependency Finder auto-detects `#include <SD.h>` and links `SD @ 2.0.0` automatically, the same way `LittleFS` already worked
- [x] 1.2 Implement on-demand SD mount/unmount helpers in `ConfigStorage` (mount immediately before an operation, unmount immediately after)
- [x] 1.3 Implement `ConfigStorage::backupToSd(config)`: serialize and write to the SD card atomically (temp filename, then rename), returning success/failure without throwing or blocking the caller
- [x] 1.4 Wire `backupToSd()` into the existing BLE-push-applies-config path, after the internal LittleFS save succeeds - done inside `ConfigStorage::save()` itself, which `ConfigService.cpp`'s push handler already calls
- [ ] 1.5 Verify on-device: apply a config via the webapp with an SD card inserted, then inspect the card on a computer to confirm the file matches

## 2. Firmware: three-tier boot recovery

- [x] 2.1 Implement `ConfigStorage::loadFromSdIfValid()`: check the SD backup file's size against the fixed cap (reject without reading if over) before reading it, then validate with the existing `parseAndValidate()`
- [x] 2.2 Update `ConfigStorage::load()` to the three-tier order: internal LittleFS -> valid SD backup (re-persisting it to LittleFS) -> hardcoded default
- [ ] 2.3 Verify on-device: wipe/corrupt the internal config with a valid SD backup present, reboot, and confirm the device recovers from the SD backup and re-persists it internally
- [ ] 2.4 Verify on-device: remove the SD card entirely and confirm boot still falls back to the hardcoded default without hanging or crashing
- [ ] 2.5 Verify on-device (or via a native unit test on the size-check logic in isolation): a file at the SD backup path larger than the size cap is rejected without being fully read into memory

## 3. Hardware bring-up

- [ ] 3.1 Confirm the SD card CS pin (assumed GPIO5) and SPI bus sharing with the TFT against the physical ESP32-2432S028R unit
- [ ] 3.2 Confirm SD card mount/read/write works correctly interleaved with normal TFT rendering and touch polling (no visible glitches or slowdowns)

## 4. Documentation

- [x] 4.1 Update the README's "Known open items" to mention SD backup is implemented, and note the assumed CS pin/wiring
