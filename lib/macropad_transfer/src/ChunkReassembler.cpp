#include "macropad_transfer/ChunkReassembler.h"

namespace macropad {

ChunkReassembler::ChunkReassembler(uint32_t timeoutMillis)
    : timeoutMillis_(timeoutMillis) {}

void ChunkReassembler::reset() {
  buffer_.clear();
  totalLength_ = 0;
  received_ = 0;
  inProgress_ = false;
}

ChunkResult ChunkReassembler::feed(const uint8_t* data, size_t len,
                                   uint32_t nowMillis) {
  if (len < 4) {
    return ChunkResult::Rejected;
  }

  uint16_t totalLength = static_cast<uint16_t>(data[0] | (data[1] << 8));
  uint16_t offset = static_cast<uint16_t>(data[2] | (data[3] << 8));
  size_t payloadLen = len - 4;

  // Discard a stale in-progress buffer if too long has passed since its last
  // chunk (macropad-ble-config-protocol: "Inactivity mid-transfer discards
  // the partial buffer").
  if (inProgress_ && (nowMillis - lastChunkMillis_) > timeoutMillis_) {
    reset();
  }

  if (offset == 0) {
    // A chunk at offset 0 starts a (possibly new) transfer. If one was
    // already in progress, it's abandoned in favor of this one
    // (macropad-ble-config-protocol: "A new transfer starting discards a
    // stale partial buffer").
    if (inProgress_) {
      reset();
    }
    inProgress_ = true;
    totalLength_ = totalLength;
    received_ = 0;
    buffer_.clear();
    buffer_.reserve(totalLength_);
  }

  if (!inProgress_) {
    return ChunkResult::Rejected;
  }
  if (totalLength != totalLength_ || offset != received_) {
    // Either declares a different total than the transfer in progress, or
    // isn't the next expected offset (out of order / duplicate / corrupt).
    return ChunkResult::Rejected;
  }

  buffer_.append(reinterpret_cast<const char*>(data + 4), payloadLen);
  received_ = static_cast<uint16_t>(received_ + payloadLen);
  lastChunkMillis_ = nowMillis;

  if (received_ >= totalLength_) {
    inProgress_ = false;
    return ChunkResult::Complete;
  }
  return ChunkResult::Incomplete;
}

}  // namespace macropad
