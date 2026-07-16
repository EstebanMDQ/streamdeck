#include "macropad_icon/IconValidation.h"

namespace macropad {

bool isValidIconSize(size_t byteCount) {
  return byteCount == kIconExpectedBytes;
}

}  // namespace macropad
