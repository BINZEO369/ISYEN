"use strict";
const validators = require("../validators");
const automation = require("./automation");
function options() {
  return {
    device_pins: [...validators.DEVICE_PINS],
    sensor_pins: [...validators.SENSOR_PINS],
    sensor_types: [...validators.VALID_SENSOR_TYPES],
    sub_node_sensor_types: [...validators.SUB_NODE_SENSOR_TYPES],
    digital_sensor_types: automation.options().digital_sensor_types,
    pir_trigger_states: [...validators.PIR_TRIGGER_STATES],
    automation: automation.options(),
  };
}
module.exports = { options };
