#include <unity.h>

#include <string>
#include <vector>

#include "macropad_transfer/ChunkReassembler.h"

using namespace macropad;

void setUp() {}
void tearDown() {}

static std::vector<uint8_t> makeChunk(uint16_t totalLength, uint16_t offset,
                                       const std::string& payload) {
  std::vector<uint8_t> out;
  out.push_back(static_cast<uint8_t>(totalLength & 0xFF));
  out.push_back(static_cast<uint8_t>((totalLength >> 8) & 0xFF));
  out.push_back(static_cast<uint8_t>(offset & 0xFF));
  out.push_back(static_cast<uint8_t>((offset >> 8) & 0xFF));
  out.insert(out.end(), payload.begin(), payload.end());
  return out;
}

void test_single_chunk_completes_immediately() {
  ChunkReassembler r;
  std::string data = "hello";
  auto chunk = makeChunk(static_cast<uint16_t>(data.size()), 0, data);
  ChunkResult result = r.feed(chunk.data(), chunk.size(), 1000);
  TEST_ASSERT_EQUAL(static_cast<int>(ChunkResult::Complete),
                     static_cast<int>(result));
  TEST_ASSERT_EQUAL_STRING("hello", r.payload().c_str());
}

void test_multi_chunk_reassembles_in_order() {
  ChunkReassembler r;
  std::string full = "hello world";
  std::string part1 = full.substr(0, 5);
  std::string part2 = full.substr(5);
  auto c1 = makeChunk(static_cast<uint16_t>(full.size()), 0, part1);
  auto c2 = makeChunk(static_cast<uint16_t>(full.size()),
                       static_cast<uint16_t>(part1.size()), part2);

  TEST_ASSERT_EQUAL(static_cast<int>(ChunkResult::Incomplete),
                     static_cast<int>(r.feed(c1.data(), c1.size(), 1000)));
  TEST_ASSERT_EQUAL(static_cast<int>(ChunkResult::Complete),
                     static_cast<int>(r.feed(c2.data(), c2.size(), 1100)));
  TEST_ASSERT_EQUAL_STRING("hello world", r.payload().c_str());
}

void test_new_transfer_discards_stale_partial_buffer() {
  ChunkReassembler r;
  // Declares a 20-byte transfer but only ever sends 5 bytes.
  auto stale = makeChunk(20, 0, "aaaaa");
  r.feed(stale.data(), stale.size(), 1000);

  // A fresh transfer starts (offset 0) before the stale one completed.
  std::string full = "fresh";
  auto freshChunk = makeChunk(static_cast<uint16_t>(full.size()), 0, full);
  ChunkResult result = r.feed(freshChunk.data(), freshChunk.size(), 2000);
  TEST_ASSERT_EQUAL(static_cast<int>(ChunkResult::Complete),
                     static_cast<int>(result));
  TEST_ASSERT_EQUAL_STRING("fresh", r.payload().c_str());
}

void test_inactivity_timeout_discards_partial_buffer() {
  ChunkReassembler r(1000);  // 1s timeout for this test
  auto c1 = makeChunk(10, 0, "aaaaa");
  r.feed(c1.data(), c1.size(), 0);

  // Continuation chunk for the same transfer, but arrives long after the
  // timeout - the partial buffer should already have been discarded, so
  // this (no longer valid) continuation is rejected rather than accepted.
  auto c2 = makeChunk(10, 5, "bbbbb");
  ChunkResult result = r.feed(c2.data(), c2.size(), 5000);
  TEST_ASSERT_EQUAL(static_cast<int>(ChunkResult::Rejected),
                     static_cast<int>(result));
}

void test_out_of_order_chunk_is_rejected() {
  ChunkReassembler r;
  auto c1 = makeChunk(10, 0, "aaaaa");
  r.feed(c1.data(), c1.size(), 0);

  // Skips ahead instead of continuing at offset 5.
  auto c2 = makeChunk(10, 7, "bbb");
  ChunkResult result = r.feed(c2.data(), c2.size(), 100);
  TEST_ASSERT_EQUAL(static_cast<int>(ChunkResult::Rejected),
                     static_cast<int>(result));
}

void test_chunk_with_no_prior_transfer_is_rejected() {
  ChunkReassembler r;
  auto c = makeChunk(10, 4, "bbbb");  // continuation with nothing started
  ChunkResult result = r.feed(c.data(), c.size(), 0);
  TEST_ASSERT_EQUAL(static_cast<int>(ChunkResult::Rejected),
                     static_cast<int>(result));
}

void test_reset_abandons_in_progress_transfer() {
  ChunkReassembler r;
  auto c1 = makeChunk(10, 0, "aaaaa");
  r.feed(c1.data(), c1.size(), 0);  // Incomplete, 5/10 received

  r.reset();  // simulates a BLE disconnect

  // A continuation at the old offset should now be rejected since the
  // buffer was abandoned, not silently resumed.
  auto c2 = makeChunk(10, 5, "bbbbb");
  ChunkResult result = r.feed(c2.data(), c2.size(), 10);
  TEST_ASSERT_EQUAL(static_cast<int>(ChunkResult::Rejected),
                     static_cast<int>(result));
}

int main(int argc, char** argv) {
  UNITY_BEGIN();
  RUN_TEST(test_single_chunk_completes_immediately);
  RUN_TEST(test_multi_chunk_reassembles_in_order);
  RUN_TEST(test_new_transfer_discards_stale_partial_buffer);
  RUN_TEST(test_inactivity_timeout_discards_partial_buffer);
  RUN_TEST(test_out_of_order_chunk_is_rejected);
  RUN_TEST(test_chunk_with_no_prior_transfer_is_rejected);
  RUN_TEST(test_reset_abandons_in_progress_transfer);
  return UNITY_END();
}
