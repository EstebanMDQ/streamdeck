#include <unity.h>

#include "macropad_config/Config.h"

using namespace macropad;

void setUp() {}
void tearDown() {}

static const char* kValidConfig = R"JSON({
  "schemaVersion": 1,
  "rootLayer": "root",
  "layers": {
    "root": {
      "buttons": [
        {"label": "Copy", "color": "#264653", "action": {"type": "key", "usage": 6, "modifiers": ["ctrl"]}},
        {"label": "Play", "color": "#2a9d8f", "action": {"type": "media", "key": "play_pause"}},
        {"label": "Edit", "color": "#e76f51", "action": {"type": "layer", "target": "edit-layer"}},
        null, null, null
      ]
    },
    "edit-layer": {
      "buttons": [null, null, null, null, null, null]
    }
  }
})JSON";

void test_valid_config_is_accepted() {
  MacroConfig config;
  ApplyResult result = parseAndValidate(kValidConfig, config);
  TEST_ASSERT_EQUAL(static_cast<int>(ApplyResult::Applied),
                     static_cast<int>(result));
  TEST_ASSERT_EQUAL_STRING("root", config.rootLayer.c_str());
  TEST_ASSERT_EQUAL(2, static_cast<int>(config.layers.size()));

  const Layer* root = config.findLayer("root");
  TEST_ASSERT_NOT_NULL(root);
  TEST_ASSERT_TRUE(root->buttons[0].present);
  TEST_ASSERT_EQUAL(static_cast<int>(ActionType::Key),
                     static_cast<int>(root->buttons[0].action.type));
  TEST_ASSERT_EQUAL(6, root->buttons[0].action.keyUsage);
  TEST_ASSERT_FALSE(root->buttons[3].present);
}

void test_malformed_json_is_rejected() {
  MacroConfig config;
  ApplyResult result = parseAndValidate("{not valid json", config);
  TEST_ASSERT_EQUAL(static_cast<int>(ApplyResult::RejectedInvalidJson),
                     static_cast<int>(result));
}

void test_unsupported_schema_version_is_rejected() {
  MacroConfig config;
  std::string json = R"JSON({
    "schemaVersion": 99,
    "rootLayer": "root",
    "layers": {"root": {"buttons": [null,null,null,null,null,null]}}
  })JSON";
  ApplyResult result = parseAndValidate(json, config);
  TEST_ASSERT_EQUAL(static_cast<int>(ApplyResult::RejectedSchemaVersion),
                     static_cast<int>(result));
}

void test_wrong_slot_count_is_rejected() {
  MacroConfig config;
  std::string json = R"JSON({
    "schemaVersion": 1,
    "rootLayer": "root",
    "layers": {"root": {"buttons": [null,null,null,null,null]}}
  })JSON";
  ApplyResult result = parseAndValidate(json, config);
  TEST_ASSERT_EQUAL(static_cast<int>(ApplyResult::RejectedStructure),
                     static_cast<int>(result));
}

void test_unknown_action_type_is_rejected() {
  MacroConfig config;
  std::string json = R"JSON({
    "schemaVersion": 1,
    "rootLayer": "root",
    "layers": {"root": {"buttons": [
      {"label":"X","color":"#000000","action":{"type":"teleport"}},
      null,null,null,null,null]}}
  })JSON";
  ApplyResult result = parseAndValidate(json, config);
  TEST_ASSERT_EQUAL(static_cast<int>(ApplyResult::RejectedStructure),
                     static_cast<int>(result));
}

void test_invalid_media_key_is_rejected() {
  MacroConfig config;
  std::string json = R"JSON({
    "schemaVersion": 1,
    "rootLayer": "root",
    "layers": {"root": {"buttons": [
      {"label":"X","color":"#000000","action":{"type":"media","key":"teleport"}},
      null,null,null,null,null]}}
  })JSON";
  ApplyResult result = parseAndValidate(json, config);
  TEST_ASSERT_EQUAL(static_cast<int>(ApplyResult::RejectedStructure),
                     static_cast<int>(result));
}

void test_invalid_modifier_is_rejected() {
  MacroConfig config;
  std::string json = R"JSON({
    "schemaVersion": 1,
    "rootLayer": "root",
    "layers": {"root": {"buttons": [
      {"label":"X","color":"#000000","action":{"type":"key","usage":4,"modifiers":["meta"]}},
      null,null,null,null,null]}}
  })JSON";
  ApplyResult result = parseAndValidate(json, config);
  TEST_ASSERT_EQUAL(static_cast<int>(ApplyResult::RejectedStructure),
                     static_cast<int>(result));
}

void test_empty_layer_target_is_rejected() {
  MacroConfig config;
  std::string json = R"JSON({
    "schemaVersion": 1,
    "rootLayer": "root",
    "layers": {"root": {"buttons": [
      {"label":"X","color":"#000000","action":{"type":"layer","target":""}},
      null,null,null,null,null]}}
  })JSON";
  ApplyResult result = parseAndValidate(json, config);
  TEST_ASSERT_EQUAL(static_cast<int>(ApplyResult::RejectedStructure),
                     static_cast<int>(result));
}

void test_default_config_round_trips_through_validation() {
  MacroConfig config = defaultConfig();
  std::string json = serialize(config);

  MacroConfig reparsed;
  ApplyResult result = parseAndValidate(json, reparsed);
  TEST_ASSERT_EQUAL(static_cast<int>(ApplyResult::Applied),
                     static_cast<int>(result));
  TEST_ASSERT_EQUAL_STRING(config.rootLayer.c_str(),
                           reparsed.rootLayer.c_str());
}

void test_a_bad_push_leaves_output_config_untouched() {
  MacroConfig config = defaultConfig();
  MacroConfig before = config;

  ApplyResult result = parseAndValidate("not json at all", config);
  TEST_ASSERT_EQUAL(static_cast<int>(ApplyResult::RejectedInvalidJson),
                     static_cast<int>(result));
  TEST_ASSERT_EQUAL_STRING(before.rootLayer.c_str(), config.rootLayer.c_str());
  TEST_ASSERT_EQUAL(static_cast<int>(before.layers.size()),
                     static_cast<int>(config.layers.size()));
}

void test_icon_field_round_trips_when_present() {
  std::string json = R"JSON({
    "schemaVersion": 1,
    "rootLayer": "root",
    "layers": {"root": {"buttons": [
      {"label":"X","color":"#000000","icon":"a1b2c3d4","action":{"type":"media","key":"mute"}},
      null,null,null,null,null]}}
  })JSON";
  MacroConfig config;
  ApplyResult result = parseAndValidate(json, config);
  TEST_ASSERT_EQUAL(static_cast<int>(ApplyResult::Applied),
                     static_cast<int>(result));
  const Layer* root = config.findLayer("root");
  TEST_ASSERT_NOT_NULL(root);
  TEST_ASSERT_EQUAL_STRING("a1b2c3d4", root->buttons[0].icon.c_str());

  std::string reserialized = serialize(config);
  MacroConfig reparsed;
  TEST_ASSERT_EQUAL(
      static_cast<int>(ApplyResult::Applied),
      static_cast<int>(parseAndValidate(reserialized, reparsed)));
  TEST_ASSERT_EQUAL_STRING(
      "a1b2c3d4", reparsed.findLayer("root")->buttons[0].icon.c_str());
}

void test_icon_field_absent_when_not_set() {
  MacroConfig config = defaultConfig();
  TEST_ASSERT_TRUE(config.layers[0].buttons[0].icon.empty());
  std::string json = serialize(config);
  TEST_ASSERT_TRUE(json.find("\"icon\"") == std::string::npos);
}

int main(int argc, char** argv) {
  UNITY_BEGIN();
  RUN_TEST(test_valid_config_is_accepted);
  RUN_TEST(test_malformed_json_is_rejected);
  RUN_TEST(test_unsupported_schema_version_is_rejected);
  RUN_TEST(test_wrong_slot_count_is_rejected);
  RUN_TEST(test_unknown_action_type_is_rejected);
  RUN_TEST(test_invalid_media_key_is_rejected);
  RUN_TEST(test_invalid_modifier_is_rejected);
  RUN_TEST(test_empty_layer_target_is_rejected);
  RUN_TEST(test_default_config_round_trips_through_validation);
  RUN_TEST(test_a_bad_push_leaves_output_config_untouched);
  RUN_TEST(test_icon_field_round_trips_when_present);
  RUN_TEST(test_icon_field_absent_when_not_set);
  return UNITY_END();
}
