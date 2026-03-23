import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asString, parseObject } from "../utils.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const connectionMode = asString(config.connectionMode, "lettabot");

  checks.push({
    code: "letta_connection_mode",
    level: "info",
    message: `Connection mode: ${connectionMode}`,
  });

  if (connectionMode === "lettabot") {
    await testLettaBotConnection(config, checks);
  } else {
    await testDirectLettaConnection(config, checks);
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}

async function testLettaBotConnection(
  config: Record<string, unknown>,
  checks: AdapterEnvironmentCheck[],
): Promise<void> {
  const lettabotUrl = asString(config.lettabotUrl, "http://lettabot.railway.internal:8080");
  const lettabotAgentName = asString(config.lettabotAgentName, "");

  if (!lettabotAgentName) {
    checks.push({
      code: "letta_lettabot_agent_name_missing",
      level: "error",
      message: "LettaBot agent name is required.",
      hint: "Set adapterConfig.lettabotAgentName to the agent name in LettaBot config.",
    });
  } else {
    checks.push({
      code: "letta_lettabot_agent_name",
      level: "info",
      message: `LettaBot agent name: ${lettabotAgentName}`,
    });
  }

  // Validate URL
  let url: URL | null = null;
  try {
    url = new URL(lettabotUrl);
    checks.push({
      code: "letta_lettabot_url_valid",
      level: "info",
      message: `LettaBot endpoint: ${url.toString()}`,
    });
  } catch {
    checks.push({
      code: "letta_lettabot_url_invalid",
      level: "error",
      message: `Invalid LettaBot URL: ${lettabotUrl}`,
    });
    return;
  }

  // Probe LettaBot health
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const healthUrl = `${lettabotUrl.replace(/\/$/, "")}/api/v1/health`;
    const response = await fetch(healthUrl, {
      method: "GET",
      signal: controller.signal,
    });

    if (response.ok) {
      checks.push({
        code: "letta_lettabot_reachable",
        level: "info",
        message: "LettaBot is reachable and healthy.",
      });
    } else {
      // Try the base URL as fallback probe
      const baseResponse = await fetch(lettabotUrl, {
        method: "HEAD",
        signal: controller.signal,
      }).catch(() => null);

      if (baseResponse) {
        checks.push({
          code: "letta_lettabot_reachable_no_health",
          level: "warn",
          message: `LettaBot reachable but health endpoint returned ${response.status}.`,
          hint: "The /api/v1/health endpoint may not exist. Verify LettaBot version.",
        });
      } else {
        checks.push({
          code: "letta_lettabot_unhealthy",
          level: "warn",
          message: `LettaBot health check returned ${response.status}.`,
          hint: "Verify LettaBot is running and accessible via internal networking.",
        });
      }
    }
  } catch (err) {
    checks.push({
      code: "letta_lettabot_unreachable",
      level: "warn",
      message: err instanceof Error ? err.message : "LettaBot probe failed",
      hint: "Verify LettaBot is running in the same Railway project and internal networking is enabled.",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function testDirectLettaConnection(
  config: Record<string, unknown>,
  checks: AdapterEnvironmentCheck[],
): Promise<void> {
  const lettaBaseUrl = asString(config.lettaBaseUrl, "https://api.letta.ai");
  const lettaAgentId = asString(config.lettaAgentId, "");
  const lettaApiKey = asString(config.lettaApiKey, "");

  if (!lettaAgentId) {
    checks.push({
      code: "letta_agent_id_missing",
      level: "error",
      message: "Letta agent ID is required for direct mode.",
      hint: "Set adapterConfig.lettaAgentId to the Letta Cloud agent ID.",
    });
  } else {
    checks.push({
      code: "letta_agent_id",
      level: "info",
      message: `Letta agent ID: ${lettaAgentId}`,
    });
  }

  if (!lettaApiKey) {
    checks.push({
      code: "letta_api_key_missing",
      level: "error",
      message: "Letta API key is required for direct mode.",
      hint: "Set adapterConfig.lettaApiKey (or use secret:LETTA_API_KEY).",
    });
  } else {
    checks.push({
      code: "letta_api_key_present",
      level: "info",
      message: "Letta API key is configured.",
    });
  }

  // Validate URL
  try {
    new URL(lettaBaseUrl);
    checks.push({
      code: "letta_base_url_valid",
      level: "info",
      message: `Letta API endpoint: ${lettaBaseUrl}`,
    });
  } catch {
    checks.push({
      code: "letta_base_url_invalid",
      level: "error",
      message: `Invalid Letta API URL: ${lettaBaseUrl}`,
    });
    return;
  }

  // Probe Letta Cloud health
  if (lettaApiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${lettaBaseUrl.replace(/\/$/, "")}/v1/health`, {
        method: "GET",
        headers: { authorization: `Bearer ${lettaApiKey}` },
        signal: controller.signal,
      });

      if (response.ok) {
        checks.push({
          code: "letta_cloud_reachable",
          level: "info",
          message: "Letta Cloud API is reachable.",
        });
      } else {
        checks.push({
          code: "letta_cloud_unhealthy",
          level: "warn",
          message: `Letta Cloud health returned ${response.status}.`,
        });
      }
    } catch (err) {
      checks.push({
        code: "letta_cloud_unreachable",
        level: "warn",
        message: err instanceof Error ? err.message : "Letta Cloud probe failed",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
