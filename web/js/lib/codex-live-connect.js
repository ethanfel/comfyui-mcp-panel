// Connection details for attaching a normal Codex session to the live-canvas
// panel_* MCP hosted by the companion comfyui-mcp orchestrator.

export const CODEX_LIVE_MCP_NAME = "comfyui-panel";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function unavailable(reason) {
  return {
    available: false,
    reason,
    url: null,
    command: null,
    remote: false,
    tokenEnvVar: null,
  };
}

function routeUrl(baseUrl, routeId) {
  let parsed;
  try {
    parsed = new URL(String(baseUrl || ""));
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/${encodeURIComponent(routeId)}`;
  return parsed.toString();
}

function advertisedRemoteConnection(panelMcp, routeId) {
  if (!panelMcp || typeof panelMcp !== "object") return null;
  const tokenEnvVar =
    typeof panelMcp.token_env_var === "string" && ENV_NAME.test(panelMcp.token_env_var)
      ? panelMcp.token_env_var
      : null;
  if (panelMcp.auth !== "bearer" || !tokenEnvVar) {
    return unavailable("The orchestrator advertised an external panel MCP without valid bearer-token metadata.");
  }
  const url = routeUrl(panelMcp.base_url, routeId);
  if (!url) return unavailable("The orchestrator advertised an invalid external panel MCP URL.");
  const command =
    `codex mcp add ${CODEX_LIVE_MCP_NAME} --url ${url}` +
    ` --bearer-token-env-var ${tokenEnvVar}`;
  return {
    available: true,
    reason: null,
    url,
    command,
    remote: true,
    tokenEnvVar,
  };
}

/**
 * Build the streamable-HTTP MCP URL and `codex mcp add` command for the panel
 * route currently connected to the orchestrator.
 *
 * Remote endpoints are accepted only when the orchestrator explicitly
 * advertises bearer authentication. Otherwise only the established loopback
 * endpoint is derived from the bridge URL.
 */
export function codexLiveCanvasConnection({
  bridgeUrl,
  routeId,
  connected = false,
  panelMcp = null,
} = {}) {
  if (!connected) {
    return unavailable("Connect the Agent panel before registering this canvas with Codex.");
  }
  if (typeof routeId !== "string" || !routeId.trim()) {
    return unavailable("This workflow tab does not have an established live-canvas route yet.");
  }
  const route = routeId.trim();

  const advertised = advertisedRemoteConnection(panelMcp, route);
  if (advertised) return advertised;

  let bridge;
  try {
    bridge = new URL(String(bridgeUrl || ""));
  } catch {
    return unavailable("The configured Bridge URL is not valid.");
  }
  if (bridge.protocol !== "ws:" || !LOOPBACK_HOSTS.has(bridge.hostname.toLowerCase())) {
    return unavailable(
      "This orchestrator has not advertised an authenticated panel MCP reachable from an external Codex host.",
    );
  }

  const bridgePort = Number(bridge.port);
  if (!Number.isInteger(bridgePort) || bridgePort < 1 || bridgePort >= 65535) {
    return unavailable("The Bridge URL must include a valid port.");
  }

  const panelMcpPort = bridgePort + 1;
  const url = `http://127.0.0.1:${panelMcpPort}/${encodeURIComponent(route)}`;
  const command = `codex mcp add ${CODEX_LIVE_MCP_NAME} --url ${url}`;
  return {
    available: true,
    reason: null,
    url,
    command,
    remote: false,
    tokenEnvVar: null,
  };
}
