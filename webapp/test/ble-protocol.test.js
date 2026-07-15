import { test } from "node:test";
import assert from "node:assert/strict";

import {
  encodeChunks,
  ChunkReassembler,
  ChunkStatus,
} from "../js/ble-protocol.js";

function textToBytes(text) {
  return new TextEncoder().encode(text);
}

test("encodeChunks: fits in a single chunk when short enough", () => {
  const bytes = textToBytes("hello");
  const chunks = encodeChunks(bytes, 180);
  assert.equal(chunks.length, 1);

  const reassembler = new ChunkReassembler();
  assert.equal(reassembler.feed(chunks[0]), ChunkStatus.COMPLETE);
  assert.equal(reassembler.payloadText(), "hello");
});

test("encodeChunks + ChunkReassembler round-trip a payload larger than one chunk", () => {
  const text = "x".repeat(500);
  const bytes = textToBytes(text);
  const chunks = encodeChunks(bytes, 64);
  assert.ok(chunks.length > 1);

  const reassembler = new ChunkReassembler();
  let lastStatus;
  chunks.forEach((chunk, i) => {
    lastStatus = reassembler.feed(chunk);
    if (i < chunks.length - 1) {
      assert.equal(lastStatus, ChunkStatus.INCOMPLETE);
    }
  });
  assert.equal(lastStatus, ChunkStatus.COMPLETE);
  assert.equal(reassembler.payloadText(), text);
});

test("ChunkReassembler: a new transfer (offset 0) discards a stale partial buffer", () => {
  const reassembler = new ChunkReassembler();
  const stale = encodeChunks(textToBytes("a".repeat(20)), 5); // multiple chunks
  reassembler.feed(stale[0]); // only feed the first chunk - leaves it incomplete

  const fresh = encodeChunks(textToBytes("fresh"), 180);
  assert.equal(reassembler.feed(fresh[0]), ChunkStatus.COMPLETE);
  assert.equal(reassembler.payloadText(), "fresh");
});

test("ChunkReassembler: rejects an out-of-order chunk", () => {
  const reassembler = new ChunkReassembler();
  const chunks = encodeChunks(textToBytes("abcdefghijklmno"), 5);
  assert.ok(chunks.length >= 3);
  assert.equal(reassembler.feed(chunks[0]), ChunkStatus.INCOMPLETE);
  // Skips ahead to the third chunk instead of continuing with the second.
  assert.equal(reassembler.feed(chunks[2]), ChunkStatus.REJECTED);
});

test("ChunkReassembler: rejects a chunk with no transfer in progress", () => {
  const reassembler = new ChunkReassembler();
  const chunks = encodeChunks(textToBytes("abcdefghij"), 5);
  // Feed only the second chunk (offset != 0) with nothing started yet.
  assert.equal(reassembler.feed(chunks[1]), ChunkStatus.REJECTED);
});
