// Pure chunk-framing logic for the BLE config protocol - no Web Bluetooth
// dependency, so it's directly unit-testable with Node's built-in test
// runner. Must stay byte-for-byte compatible with
// lib/macropad_transfer/src/ChunkReassembler.cpp (same
// [uint16 totalLength][uint16 offset][payload] framing, little-endian). See:
//   openspec/changes/add-macropad-mvp/specs/macropad-ble-config-protocol/spec.md
//   openspec/changes/add-macropad-mvp/specs/webapp-ble-sync/spec.md

const HEADER_LEN = 4;

// Splits `payloadBytes` (a Uint8Array) into one or more framed chunks no
// larger than `maxChunkPayload` bytes of payload each, for sequential
// writes to ConfigTransfer.
export function encodeChunks(payloadBytes, maxChunkPayload) {
  const totalLength = payloadBytes.length;
  const chunks = [];
  let offset = 0;

  do {
    const chunkLen = Math.min(maxChunkPayload, totalLength - offset);
    const frame = new Uint8Array(HEADER_LEN + chunkLen);
    frame[0] = totalLength & 0xff;
    frame[1] = (totalLength >> 8) & 0xff;
    frame[2] = offset & 0xff;
    frame[3] = (offset >> 8) & 0xff;
    frame.set(payloadBytes.subarray(offset, offset + chunkLen), HEADER_LEN);
    chunks.push(frame);
    offset += chunkLen;
  } while (offset < totalLength);

  if (chunks.length === 0) {
    // Degenerate empty-payload case: still emit one (header-only) chunk.
    chunks.push(new Uint8Array(HEADER_LEN));
  }

  return chunks;
}

export const ChunkStatus = Object.freeze({
  INCOMPLETE: "incomplete",
  COMPLETE: "complete",
  REJECTED: "rejected",
});

// Reassembles chunks received from ConfigDump notifications. Mirrors
// macropad::ChunkReassembler's in-order/new-transfer/rejection semantics
// (minus the inactivity timeout, which doesn't apply to a short-lived
// browser-side pull).
export class ChunkReassembler {
  constructor() {
    this.reset();
  }

  reset() {
    this._chunks = [];
    this._totalLength = 0;
    this._received = 0;
    this._inProgress = false;
  }

  feed(bytes) {
    if (bytes.length < HEADER_LEN) {
      return ChunkStatus.REJECTED;
    }
    const totalLength = bytes[0] | (bytes[1] << 8);
    const offset = bytes[2] | (bytes[3] << 8);
    const payload = bytes.subarray(HEADER_LEN);

    if (offset === 0) {
      this.reset();
      this._inProgress = true;
      this._totalLength = totalLength;
      this._received = 0;
    }

    if (!this._inProgress) {
      return ChunkStatus.REJECTED;
    }
    if (totalLength !== this._totalLength || offset !== this._received) {
      return ChunkStatus.REJECTED;
    }

    this._chunks.push(payload);
    this._received += payload.length;

    if (this._received >= this._totalLength) {
      this._inProgress = false;
      return ChunkStatus.COMPLETE;
    }
    return ChunkStatus.INCOMPLETE;
  }

  // Valid only immediately after feed() returns COMPLETE.
  payloadBytes() {
    const combined = new Uint8Array(this._totalLength);
    let pos = 0;
    for (const chunk of this._chunks) {
      combined.set(chunk, pos);
      pos += chunk.length;
    }
    return combined;
  }

  payloadText() {
    return new TextDecoder().decode(this.payloadBytes());
  }
}
