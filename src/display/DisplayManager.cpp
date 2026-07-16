#include "display/DisplayManager.h"

#include <SPI.h>
#include <TFT_eSPI.h>
#include <XPT2046_Touchscreen.h>

#include <cstdlib>

#include "assets/IconStorage.h"
#include "macropad_icon/IconValidation.h"

namespace macropad {

namespace {

constexpr int kScreenWidth = 320;   // landscape (rotation 1)
constexpr int kScreenHeight = 240;
constexpr int kCols = 3;
constexpr int kRows = 2;
// Full-width bar reserved at the bottom of the screen for the back
// affordance - much easier to hit reliably than a small corner square,
// especially on resistive touch (corners tend to be the least accurate
// zone) with not-yet-calibrated touch mapping. Reserved consistently across
// every layer (not just non-root ones) so button sizing never changes
// depending on which layer is shown.
constexpr int kBackBarHeight = 40;
constexpr int kGridHeight = kScreenHeight - kBackBarHeight;
constexpr uint32_t kFeedbackFlashMs = 120;

// XPT2046 touch controller wiring: a second SPI bus, separate from the
// display's, per the commonly documented ESP32-2432S028R pin map. Confirm
// against the physical board during bring-up (tasks.md 2.x) - CYD units are
// white-labeled from multiple factories and details occasionally vary.
constexpr int kTouchCsPin = 33;
constexpr int kTouchIrqPin = 36;
constexpr int kTouchMosiPin = 32;
constexpr int kTouchMisoPin = 39;
constexpr int kTouchClkPin = 25;

// Raw touch controller reading range observed on commonly documented
// ESP32-2432S028R units. Needs calibrating against the actual unit during
// bring-up rather than trusted as-is - see tasks.md 4.7.
constexpr int kTouchRawMinX = 200;
constexpr int kTouchRawMaxX = 3900;
constexpr int kTouchRawMinY = 200;
constexpr int kTouchRawMaxY = 3900;

TFT_eSPI tft;
SPIClass touchSpi(VSPI);
XPT2046_Touchscreen touch(kTouchCsPin, kTouchIrqPin);

int mapTouchX(int rawX) {
  long mapped = map(rawX, kTouchRawMinX, kTouchRawMaxX, 0, kScreenWidth);
  return constrain(mapped, 0, kScreenWidth - 1);
}

int mapTouchY(int rawY) {
  long mapped = map(rawY, kTouchRawMinY, kTouchRawMaxY, 0, kScreenHeight);
  return constrain(mapped, 0, kScreenHeight - 1);
}

uint16_t parseHexColor(const std::string& hex) {
  if (hex.size() != 7 || hex[0] != '#') {
    return TFT_DARKGREY;
  }
  long value = strtol(hex.c_str() + 1, nullptr, 16);
  uint8_t r = (value >> 16) & 0xFF;
  uint8_t g = (value >> 8) & 0xFF;
  uint8_t b = value & 0xFF;
  return tft.color565(r, g, b);
}

}  // namespace

void DisplayManager::begin() {
  tft.init();
  tft.setRotation(1);  // landscape, 320x240
  // Paired with webapp/js/icon.js's rgbaToRgb565() packing bytes
  // big-endian per pixel - a deliberate, documented guess pending the
  // hardware verification in tasks.md 2.2/5.5. If icon colors come out
  // channel-swapped, flip this to false first before touching anything
  // else - it's the single adjustable knob for this exact mismatch.
  tft.setSwapBytes(true);
  tft.fillScreen(TFT_BLACK);

  touchSpi.begin(kTouchClkPin, kTouchMisoPin, kTouchMosiPin, kTouchCsPin);
  touch.begin(touchSpi);
  touch.setRotation(1);
}

void DisplayManager::setConfig(const MacroConfig& config) {
  config_ = config;

  // macropad-display-ui: "Navigation resets to root if the active layer
  // disappears from a new configuration".
  if (navigationStack_.empty()) {
    navigationStack_.push_back(config_.rootLayer);
  } else if (!config_.findLayer(navigationStack_.back())) {
    navigationStack_.clear();
    navigationStack_.push_back(config_.rootLayer);
  }
  needsRedraw_ = true;
}

void DisplayManager::setHidConnected(bool connected) {
  if (connected == hidConnected_) {
    return;  // no-op if the connection state hasn't actually changed
  }
  hidConnected_ = connected;
  needsRedraw_ = true;
}

void DisplayManager::loop() {
  if (needsRedraw_) {
    render();
    needsRedraw_ = false;
  }

  // Touches are only meaningful once the button grid is showing - the idle
  // screen has nothing to press.
  if (hidConnected_ && touch.tirqTouched() && touch.touched()) {
    TS_Point p = touch.getPoint();
    handleTouch(mapTouchX(p.x), mapTouchY(p.y));
  }
}

void DisplayManager::render() {
  if (hidConnected_) {
    renderCurrentLayer();
  } else {
    renderIdleScreen();
  }
}

void DisplayManager::renderIdleScreen() {
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("Streamdeck CYD", kScreenWidth / 2, kScreenHeight / 2 - 12, 4);
  tft.setTextColor(TFT_DARKGREY, TFT_BLACK);
  tft.drawString("Waiting for Bluetooth connection...", kScreenWidth / 2,
                  kScreenHeight / 2 + 16, 2);
}

void DisplayManager::renderCurrentLayer() {
  tft.fillScreen(TFT_BLACK);
  if (navigationStack_.empty()) {
    return;
  }

  const Layer* layer = config_.findLayer(navigationStack_.back());
  if (!layer) {
    return;
  }

  int cellW = kScreenWidth / kCols;
  int cellH = kGridHeight / kRows;
  for (int i = 0; i < kButtonsPerLayer; ++i) {
    const ButtonSlot& slot = layer->buttons[i];
    if (!slot.present) {
      continue;  // empty slot renders blank
    }
    int col = i % kCols;
    int row = i / kCols;
    int x = col * cellW;
    int y = row * cellH;

    uint16_t color = parseHexColor(slot.color);
    bool iconRendered =
        !slot.icon.empty() && renderIconIfPresent(slot, x, y, cellW, cellH);

    if (!iconRendered) {
      tft.fillRect(x + 2, y + 2, cellW - 4, cellH - 4, color);
      tft.setTextColor(TFT_WHITE, color);
      tft.setTextDatum(MC_DATUM);
      tft.drawString(slot.label.c_str(), x + cellW / 2, y + cellH / 2, 2);
    } else {
      // Label overlay: a small strip at the bottom of the cell, over the
      // icon, so icon buttons remain identifiable by name (macropad-display-
      // ui: "the label is still drawn as an overlay").
      constexpr int kLabelStripHeight = 20;
      int stripY = y + cellH - kLabelStripHeight - 2;
      tft.fillRect(x + 2, stripY, cellW - 4, kLabelStripHeight, color);
      tft.setTextColor(TFT_WHITE, color);
      tft.setTextDatum(MC_DATUM);
      tft.drawString(slot.label.c_str(), x + cellW / 2,
                      stripY + kLabelStripHeight / 2, 1);
    }
  }

  // Back affordance: a full-width bar along the bottom, shown only outside
  // the root layer.
  if (navigationStack_.size() > 1) {
    tft.fillRect(0, kGridHeight, kScreenWidth, kBackBarHeight, TFT_DARKGREY);
    tft.setTextColor(TFT_WHITE, TFT_DARKGREY);
    tft.setTextDatum(MC_DATUM);
    tft.drawString("< Back", kScreenWidth / 2, kGridHeight + kBackBarHeight / 2,
                   2);
  }
}

bool DisplayManager::renderIconIfPresent(const ButtonSlot& slot, int x, int y,
                                          int cellW, int cellH) {
  std::string bytes;
  if (!IconStorage::load(slot.icon, bytes)) {
    return false;  // missing or wrong-sized file - caller falls back to color
  }

  // Centered within the cell; icons are always exactly kIconWidth x
  // kIconHeight (IconStorage::load only returns true for a correctly-sized
  // bitmap), no scaling involved - TFT_eSPI::pushImage() is a 1:1 blit.
  int iconX = x + (cellW - kIconWidth) / 2;
  int iconY = y + (cellH - kIconHeight) / 2;

  // NOTE: byte order between the webapp's packed RGB565 bytes and what
  // pushImage() expects here is unverified against real hardware - see
  // design.md's Risks section and tasks.md section 2's early hardware
  // check. If colors come out channel-swapped during that check, TFT_eSPI's
  // tft.setSwapBytes(true) (called once in begin(), not here) is the fix -
  // no need to re-pack every stored icon's bytes.
  const uint16_t* pixels = reinterpret_cast<const uint16_t*>(bytes.data());
  tft.pushImage(iconX, iconY, kIconWidth, kIconHeight, pixels);
  return true;
}

void DisplayManager::handleTouch(int x, int y) {
  if (navigationStack_.size() > 1 && y >= kGridHeight) {
    navigateBack();
    return;
  }

  int cellW = kScreenWidth / kCols;
  int cellH = kGridHeight / kRows;
  int col = x / cellW;
  int row = y / cellH;
  if (col >= kCols || row >= kRows) {
    return;
  }
  int index = row * kCols + col;

  if (navigationStack_.empty()) {
    return;
  }
  const Layer* layer = config_.findLayer(navigationStack_.back());
  if (!layer) {
    return;
  }
  const ButtonSlot& slot = layer->buttons[index];
  if (!slot.present) {
    return;  // touch on empty slot has no effect
  }

  // macropad-display-ui: visual feedback regardless of whether the action
  // is actually delivered.
  flashSlotFeedback(index);

  switch (slot.action.type) {
    case ActionType::Layer:
      navigateTo(slot.action.layerTarget);
      break;
    case ActionType::Key:
    case ActionType::Media:
      if (actionCallback_) {
        actionCallback_(slot.action);
      }
      break;
    case ActionType::None:
      break;
  }
}

void DisplayManager::navigateTo(const std::string& layerId) {
  if (!config_.findLayer(layerId)) {
    return;
  }
  navigationStack_.push_back(layerId);
  needsRedraw_ = true;
}

void DisplayManager::navigateBack() {
  if (navigationStack_.size() > 1) {
    navigationStack_.pop_back();
    needsRedraw_ = true;
  }
}

void DisplayManager::flashSlotFeedback(int slotIndex) {
  int cellW = kScreenWidth / kCols;
  int cellH = kGridHeight / kRows;
  int col = slotIndex % kCols;
  int row = slotIndex / kCols;
  int x = col * cellW;
  int y = row * cellH;

  tft.drawRect(x + 2, y + 2, cellW - 4, cellH - 4, TFT_WHITE);
  delay(kFeedbackFlashMs);
  needsRedraw_ = true;  // full redraw clears the flash outline next loop()
}

}  // namespace macropad
