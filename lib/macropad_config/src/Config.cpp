#include "macropad_config/Config.h"

#include <ArduinoJson.h>

#include <cstdlib>

namespace macropad {

namespace {

bool contains(const std::vector<std::string>& values, const std::string& v) {
  for (const auto& item : values) {
    if (item == v) return true;
  }
  return false;
}

}  // namespace

const Layer* MacroConfig::findLayer(const std::string& id) const {
  for (const auto& layer : layers) {
    if (layer.id == id) return &layer;
  }
  return nullptr;
}

bool isValidMediaKey(const std::string& key) {
  static const std::vector<std::string> kValid = {
      "play_pause", "next", "prev", "vol_up", "vol_down", "mute"};
  return contains(kValid, key);
}

bool isValidModifier(const std::string& modifier) {
  static const std::vector<std::string> kValid = {"ctrl", "shift", "alt",
                                                    "gui"};
  return contains(kValid, modifier);
}

MacroConfig defaultConfig() {
  MacroConfig config;
  config.schemaVersion = kSchemaVersion;
  config.rootLayer = "root";

  Layer root;
  root.id = "root";

  root.buttons[0].present = true;
  root.buttons[0].label = "Play";
  root.buttons[0].color = "#2a9d8f";
  root.buttons[0].action.type = ActionType::Media;
  root.buttons[0].action.mediaKey = "play_pause";

  root.buttons[1].present = true;
  root.buttons[1].label = "Copy";
  root.buttons[1].color = "#264653";
  root.buttons[1].action.type = ActionType::Key;
  root.buttons[1].action.keyUsage = 6;  // USB HID usage for 'c'
  root.buttons[1].action.modifiers = {"ctrl"};

  // Slots 2-5 left empty (present == false by default construction).

  config.layers.push_back(root);
  return config;
}

ApplyResult parseAndValidate(const std::string& json, MacroConfig& outConfig) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, json);
  if (err || !doc.is<JsonObject>()) {
    return ApplyResult::RejectedInvalidJson;
  }

  JsonVariantConst schemaVersionVal = doc["schemaVersion"];
  if (!schemaVersionVal.is<int>()) {
    return ApplyResult::RejectedStructure;
  }
  int schemaVersion = schemaVersionVal.as<int>();
  if (schemaVersion != kSchemaVersion) {
    return ApplyResult::RejectedSchemaVersion;
  }

  JsonVariantConst rootLayerVal = doc["rootLayer"];
  if (!rootLayerVal.is<const char*>()) {
    return ApplyResult::RejectedStructure;
  }
  std::string rootLayer = rootLayerVal.as<const char*>();
  if (rootLayer.empty()) {
    return ApplyResult::RejectedStructure;
  }

  JsonVariantConst layersVal = doc["layers"];
  if (!layersVal.is<JsonObjectConst>()) {
    return ApplyResult::RejectedStructure;
  }
  JsonObjectConst layersObj = layersVal.as<JsonObjectConst>();
  if (layersObj.size() == 0) {
    return ApplyResult::RejectedStructure;
  }

  std::vector<Layer> layers;
  for (JsonPairConst kv : layersObj) {
    Layer layer;
    layer.id = kv.key().c_str();

    JsonVariantConst layerVal = kv.value();
    if (!layerVal.is<JsonObjectConst>()) {
      return ApplyResult::RejectedStructure;
    }
    JsonObjectConst layerObj = layerVal.as<JsonObjectConst>();

    JsonVariantConst buttonsVal = layerObj["buttons"];
    if (!buttonsVal.is<JsonArrayConst>()) {
      return ApplyResult::RejectedStructure;
    }
    JsonArrayConst buttonsArr = buttonsVal.as<JsonArrayConst>();
    if (static_cast<int>(buttonsArr.size()) != kButtonsPerLayer) {
      return ApplyResult::RejectedStructure;
    }

    int index = 0;
    for (JsonVariantConst slotVal : buttonsArr) {
      ButtonSlot& slot = layer.buttons[index++];
      if (slotVal.isNull()) {
        slot.present = false;
        continue;
      }
      if (!slotVal.is<JsonObjectConst>()) {
        return ApplyResult::RejectedStructure;
      }
      JsonObjectConst slotObj = slotVal.as<JsonObjectConst>();
      slot.present = true;
      slot.label = slotObj["label"] | "";
      slot.color = slotObj["color"] | "";
      slot.icon = slotObj["icon"] | "";  // optional - empty means no icon

      JsonVariantConst actionVal = slotObj["action"];
      if (!actionVal.is<JsonObjectConst>()) {
        return ApplyResult::RejectedStructure;
      }
      JsonObjectConst actionObj = actionVal.as<JsonObjectConst>();
      std::string type = actionObj["type"] | "";

      if (type == "key") {
        JsonVariantConst usageVal = actionObj["usage"];
        if (!usageVal.is<int>()) {
          return ApplyResult::RejectedStructure;
        }
        slot.action.type = ActionType::Key;
        slot.action.keyUsage = usageVal.as<int>();

        JsonVariantConst modsVal = actionObj["modifiers"];
        if (!modsVal.isNull()) {
          if (!modsVal.is<JsonArrayConst>()) {
            return ApplyResult::RejectedStructure;
          }
          for (JsonVariantConst m : modsVal.as<JsonArrayConst>()) {
            if (!m.is<const char*>()) {
              return ApplyResult::RejectedStructure;
            }
            std::string mod = m.as<const char*>();
            if (!isValidModifier(mod)) {
              return ApplyResult::RejectedStructure;
            }
            slot.action.modifiers.push_back(mod);
          }
        }
      } else if (type == "media") {
        std::string key = actionObj["key"] | "";
        if (!isValidMediaKey(key)) {
          return ApplyResult::RejectedStructure;
        }
        slot.action.type = ActionType::Media;
        slot.action.mediaKey = key;
      } else if (type == "layer") {
        std::string target = actionObj["target"] | "";
        if (target.empty()) {
          return ApplyResult::RejectedStructure;
        }
        slot.action.type = ActionType::Layer;
        slot.action.layerTarget = target;
      } else {
        return ApplyResult::RejectedStructure;
      }
    }

    layers.push_back(layer);
  }

  outConfig.schemaVersion = schemaVersion;
  outConfig.rootLayer = rootLayer;
  outConfig.layers = layers;
  return ApplyResult::Applied;
}

std::string serialize(const MacroConfig& config) {
  JsonDocument doc;
  doc["schemaVersion"] = config.schemaVersion;
  doc["rootLayer"] = config.rootLayer;

  JsonObject layersObj = doc["layers"].to<JsonObject>();
  for (const Layer& layer : config.layers) {
    JsonObject layerObj = layersObj[layer.id].to<JsonObject>();
    JsonArray buttonsArr = layerObj["buttons"].to<JsonArray>();
    for (const ButtonSlot& slot : layer.buttons) {
      if (!slot.present) {
        buttonsArr.add(nullptr);
        continue;
      }
      JsonObject slotObj = buttonsArr.add<JsonObject>();
      slotObj["label"] = slot.label;
      slotObj["color"] = slot.color;
      if (!slot.icon.empty()) {
        slotObj["icon"] = slot.icon;
      }

      JsonObject actionObj = slotObj["action"].to<JsonObject>();
      switch (slot.action.type) {
        case ActionType::Key: {
          actionObj["type"] = "key";
          actionObj["usage"] = slot.action.keyUsage;
          JsonArray mods = actionObj["modifiers"].to<JsonArray>();
          for (const auto& m : slot.action.modifiers) {
            mods.add(m);
          }
          break;
        }
        case ActionType::Media:
          actionObj["type"] = "media";
          actionObj["key"] = slot.action.mediaKey;
          break;
        case ActionType::Layer:
          actionObj["type"] = "layer";
          actionObj["target"] = slot.action.layerTarget;
          break;
        case ActionType::None:
          break;
      }
    }
  }

  std::string out;
  serializeJson(doc, out);
  return out;
}

}  // namespace macropad
