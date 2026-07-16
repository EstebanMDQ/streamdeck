#include "assets/IconStorage.h"

#include <LittleFS.h>

#include "macropad_icon/IconValidation.h"

namespace macropad {

namespace {
constexpr const char* kIconDir = "/icons";
}  // namespace

std::string IconStorage::pathFor(const std::string& iconId) {
  return std::string(kIconDir) + "/" + iconId + ".bin";
}

bool IconStorage::save(const std::string& iconId, const uint8_t* bytes,
                        size_t length) {
  if (!isValidIconSize(length)) {
    return false;
  }

  if (!LittleFS.exists(kIconDir)) {
    LittleFS.mkdir(kIconDir);
  }

  File f = LittleFS.open(pathFor(iconId).c_str(), "w");
  if (!f) {
    return false;
  }
  size_t written = f.write(bytes, length);
  f.close();
  return written == length;
}

bool IconStorage::load(const std::string& iconId, std::string& outBytes) {
  outBytes.clear();

  File f = LittleFS.open(pathFor(iconId).c_str(), "r");
  if (!f) {
    return false;
  }

  outBytes.reserve(f.size());
  while (f.available()) {
    outBytes += static_cast<char>(f.read());
  }
  f.close();

  if (!isValidIconSize(outBytes.size())) {
    outBytes.clear();
    return false;
  }
  return true;
}

}  // namespace macropad
