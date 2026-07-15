#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

// Pure, host-testable chunk reassembly for the BLE ConfigTransfer
// characteristic. Implements the framing and single-in-flight-transfer
// requirements in:
//   openspec/changes/add-macropad-mvp/specs/macropad-ble-config-protocol/spec.md
// No Arduino/BLE dependency - compiles and runs identically on-device and in
// the native unit test environment.

namespace macropad {

enum class ChunkResult {
  Incomplete,  // more chunks expected
  Complete,    // payload fully reassembled; read via payload()
  Rejected     // chunk didn't fit the in-progress transfer (out of order,
               // too short, or no transfer in progress)
};

// Wire format per chunk: [uint16 totalLength][uint16 offset][payload bytes],
// little-endian, matching design.md's "BLE: two custom services" decision.
class ChunkReassembler {
 public:
  // timeoutMillis: how long between chunks of the same transfer before the
  // partial buffer is considered stale and discarded. `nowMillis` is passed
  // in by the caller on every feed() rather than read from a clock
  // internally, so this class stays deterministic and testable.
  explicit ChunkReassembler(uint32_t timeoutMillis = 15000);

  ChunkResult feed(const uint8_t* data, size_t len, uint32_t nowMillis);

  // Valid only immediately after feed() returns Complete.
  const std::string& payload() const { return buffer_; }

  // Abandons any in-progress transfer (e.g. on BLE disconnect).
  void reset();

 private:
  std::string buffer_;
  uint16_t totalLength_ = 0;
  uint16_t received_ = 0;
  bool inProgress_ = false;
  uint32_t lastChunkMillis_ = 0;
  uint32_t timeoutMillis_;
};

}  // namespace macropad
