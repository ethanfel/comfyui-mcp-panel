import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CODEX_LIVE_MCP_NAME,
  codexLiveCanvasConnection,
} from "../../web/js/lib/codex-live-connect.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PANEL_SOURCE = join(HERE, "../../web/js/comfyui-mcp-panel.js");

test("builds a Codex MCP command for the connected workflow-tab route", () => {
  const result = codexLiveCanvasConnection({
    bridgeUrl: "ws://127.0.0.1:9180",
    routeId: "tab:abc|wf:workflows/My Flow.json",
    connected: true,
  });

  assert.equal(result.available, true);
  assert.equal(result.url, "http://127.0.0.1:9181/tab%3Aabc%7Cwf%3Aworkflows%2FMy%20Flow.json");
  assert.equal(result.command, `codex mcp add ${CODEX_LIVE_MCP_NAME} --url ${result.url}`);
});

test("localhost is normalized to the orchestrator's exact loopback MCP host", () => {
  const result = codexLiveCanvasConnection({
    bridgeUrl: "ws://localhost:9400/?token=secret-not-forwarded",
    routeId: "tmp:123",
    connected: true,
  });

  assert.equal(result.url, "http://127.0.0.1:9401/tmp%3A123");
  assert.doesNotMatch(result.command, /secret-not-forwarded/);
});

test("builds an authenticated command for a panel MCP advertised across the LAN", () => {
  const result = codexLiveCanvasConnection({
    bridgeUrl: "ws://192.168.1.12:9180/?token=bridge-secret-not-forwarded",
    routeId: "tab:abc|wf:workflows/My Flow.json",
    connected: true,
    panelMcp: {
      base_url: "http://192.168.1.12:9181",
      auth: "bearer",
      token_env_var: "COMFYUI_MCP_PANEL_MCP_TOKEN",
    },
  });

  assert.equal(result.available, true);
  assert.equal(result.remote, true);
  assert.equal(result.url, "http://192.168.1.12:9181/tab%3Aabc%7Cwf%3Aworkflows%2FMy%20Flow.json");
  assert.equal(
    result.command,
    `codex mcp add ${CODEX_LIVE_MCP_NAME} --url ${result.url} --bearer-token-env-var COMFYUI_MCP_PANEL_MCP_TOKEN`,
  );
  assert.doesNotMatch(result.command, /bridge-secret-not-forwarded/);
});

test("refuses to advertise a dead endpoint before the panel is connected", () => {
  const result = codexLiveCanvasConnection({
    bridgeUrl: "ws://127.0.0.1:9180",
    routeId: "tmp:123",
    connected: false,
  });

  assert.equal(result.available, false);
  assert.match(result.reason, /Connect the Agent panel/);
});

test("fails closed for remote and secure bridge URLs without an authenticated advertisement", () => {
  for (const bridgeUrl of ["ws://192.168.1.12:9180", "wss://bridge.example.test/session"]) {
    const result = codexLiveCanvasConnection({ bridgeUrl, routeId: "tmp:123", connected: true });
    assert.equal(result.available, false, bridgeUrl);
    assert.equal(result.command, null, bridgeUrl);
  }
});

test("fails closed for malformed external authentication metadata", () => {
  for (const panelMcp of [
    { base_url: "http://192.168.1.12:9181", auth: "none", token_env_var: "TOKEN" },
    { base_url: "http://192.168.1.12:9181", auth: "bearer", token_env_var: "not valid" },
    { base_url: "file:///tmp/mcp", auth: "bearer", token_env_var: "TOKEN" },
  ]) {
    const result = codexLiveCanvasConnection({
      bridgeUrl: "ws://192.168.1.12:9180",
      routeId: "tmp:123",
      connected: true,
      panelMcp,
    });
    assert.equal(result.available, false);
    assert.equal(result.command, null);
  }
});

test("requires both an established route and an explicit bridge port", () => {
  assert.equal(
    codexLiveCanvasConnection({ bridgeUrl: "ws://127.0.0.1:9180", routeId: "", connected: true }).available,
    false,
  );
  assert.equal(
    codexLiveCanvasConnection({ bridgeUrl: "ws://127.0.0.1", routeId: "tmp:123", connected: true }).available,
    false,
  );
});

test("the Advanced settings UI derives the command from the established bridge route", () => {
  const source = readFileSync(PANEL_SOURCE, "utf8");
  assert.match(source, /codexLiveCanvasConnection\(\{/);
  assert.match(source, /routeId:\s*connected \? bridgeRouteId\(\) : null/);
  assert.match(source, /panelMcp:\s*cmcpPanelMcp/);
  assert.match(source, /Use this canvas from Codex/);
  assert.match(source, /start a new Codex session/);
});
