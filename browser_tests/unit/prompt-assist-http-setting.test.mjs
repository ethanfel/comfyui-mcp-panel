import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../web/js/comfyui-mcp-panel.js", import.meta.url), "utf8");

test("direct HTTP prompt assistance is an explicit global setting, off by default", () => {
  assert.match(source, /SETTING_PROMPT_ASSIST_HTTP/);
  assert.match(source, /name: "Allow direct HTTP providers"/);
  assert.match(source, /defaultValue: false/);
  assert.match(source, /never stored in a workflow/);
  assert.match(source, /function sendPromptAssistHttpConfig\(\)/);
  assert.match(source, /prompt_assist_http: getSetting\(SETTING_PROMPT_ASSIST_HTTP\) === true/);
  assert.match(source, /panelHooks\.applyPromptAssistHttpConfig\?\.\(\)/);
  assert.match(source, /sendPromptAssistHttpConfig\(\);/);
});
