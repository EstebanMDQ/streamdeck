#include <unity.h>

#include "macropad_icon/IconValidation.h"

using namespace macropad;

void setUp() {}
void tearDown() {}

void test_exact_size_is_valid() {
  TEST_ASSERT_TRUE(isValidIconSize(kIconExpectedBytes));
}

void test_expected_size_is_8192_bytes() {
  // 64x64 pixels, 2 bytes/pixel (RGB565) - pinned down explicitly so a
  // future change to kIconWidth/kIconHeight/kIconBytesPerPixel can't
  // silently drift the expected size without a test noticing.
  TEST_ASSERT_EQUAL_UINT32(8192, static_cast<uint32_t>(kIconExpectedBytes));
}

void test_one_byte_too_few_is_invalid() {
  TEST_ASSERT_FALSE(isValidIconSize(kIconExpectedBytes - 1));
}

void test_one_byte_too_many_is_invalid() {
  TEST_ASSERT_FALSE(isValidIconSize(kIconExpectedBytes + 1));
}

void test_zero_bytes_is_invalid() {
  TEST_ASSERT_FALSE(isValidIconSize(0));
}

void test_grossly_oversized_is_invalid() {
  TEST_ASSERT_FALSE(isValidIconSize(kIconExpectedBytes * 100));
}

int main(int argc, char** argv) {
  UNITY_BEGIN();
  RUN_TEST(test_exact_size_is_valid);
  RUN_TEST(test_expected_size_is_8192_bytes);
  RUN_TEST(test_one_byte_too_few_is_invalid);
  RUN_TEST(test_one_byte_too_many_is_invalid);
  RUN_TEST(test_zero_bytes_is_invalid);
  RUN_TEST(test_grossly_oversized_is_invalid);
  return UNITY_END();
}
