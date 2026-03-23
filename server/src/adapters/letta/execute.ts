import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString, asNumber, parseObject } from "../utils.js";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, runId, agent, context } = ctx;

  // Connection mode: "lettabot" (via LettaBot bridge) or "direct" (Letta Cloud API)
  const connectionMode = asString(config.connectionMode, "lettabot");

  if (connectionMode === "lettabot") {
    return executeViaLettaBot(ctx);
  }
  return executeDirectLetta(ctx);
}

/**
 * Execute via LettaBot internal API.
 * Paperclip → LettaBot (Railway internal) → Letta Cloud → Agent
 */
async function executeViaLettaBot(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, runId, agent, context } = ctx;

  const lettabotUrl = asString(config.lettabotUrl, "http://lettabot.railway.internal:8080");
  const lettabotAgentName = asString(config.lettabotAgentName, agent.name);
  const lettabotApiKey = asString(config.lettabotApiKey, "");
  const timeoutMs = asNumber(config.timeoutMs, 120000);

  const endpoint = `${lettabotUrl.replace(/\/$/, "")}/api/v1/chat`;

  // Build the message with Paperclip context
  const message = buildMessage(context, runId, agent);

  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (lettabotApiKey) {
      headers["authorization"] = `Bearer ${lettabotApiKey}`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        agent: lettabotAgentName,
        message,
      }),
      ...(timer ? { signal: controller.signal } : {}),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `LettaBot invoke failed with status ${res.status}: ${errorText.slice(0, 500)}`
      );
    }

    const responseData = await res.json().catch(() => ({}));

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary: `LettaBot → ${lettabotAgentName}: ${JSON.stringify(responseData).slice(0, 200)}`,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        exitCode: 1,
        signal: "SIGTERM",
        timedOut: true,
        summary: `LettaBot request timed out after ${timeoutMs}ms`,
      };
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Execute directly against Letta Cloud API.
 * Paperclip → Letta Cloud → Agent
 */
async function executeDirectLetta(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, runId, agent, context } = ctx;

  const lettaBaseUrl = asString(config.lettaBaseUrl, "https://api.letta.ai");
  const lettaAgentId = asString(config.lettaAgentId, "");
  const lettaApiKey = asString(config.lettaApiKey, "");
  const timeoutMs = asNumber(config.timeoutMs, 120000);

  if (!lettaAgentId) {
    throw new Error("Letta adapter (direct mode) requires lettaAgentId");
  }
  if (!lettaApiKey) {
    throw new Error("Letta adapter (direct mode) requires lettaApiKey");
  }

  const endpoint = `${lettaBaseUrl.replace(/\/$/, "")}/v1/agents/${lettaAgentId}/messages`;
  const message = buildMessage(context, runId, agent);

  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${lettaApiKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
      }),
      ...(timer ? { signal: controller.signal } : {}),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `Letta Cloud invoke failed with status ${res.status}: ${errorText.slice(0, 500)}`
      );
    }

    const responseData = await res.json().catch(() => ({}));

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary: `Letta Cloud → ${lettaAgentId}: ${JSON.stringify(responseData).slice(0, 200)}`,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        exitCode: 1,
        signal: "SIGTERM",
        timedOut: true,
        summary: `Letta Cloud request timed out after ${timeoutMs}ms`,
      };
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Build a structured message from Paperclip execution context.
 */
function buildMessage(
  context: AdapterExecutionContext["context"],
  runId: string,
  agent: AdapterExecutionContext["agent"],
): string {
  const parts: string[] = [];

  parts.push(`[Paperclip Task | Run: ${runId}]`);

  if (context.issue) {
    parts.push(`Issue: ${context.issue.identifier ?? context.issue.id} — ${context.issue.title}`);
    if (context.issue.description) {
      parts.push(`Description: ${context.issue.description}`);
    }
  }

  if (context.prompt) {
    parts.push(`Prompt: ${context.prompt}`);
  }

  if (context.parentMessages && context.parentMessages.length > 0) {
    parts.push(`Context messages: ${context.parentMessages.length}`);
    for (const msg of context.parentMessages.slice(-3)) {
      parts.push(`  [${msg.role}]: ${typeof msg.content === "string" ? msg.content.slice(0, 500) : JSON.stringify(msg.content).slice(0, 500)}`);
    }
  }

  return parts.join("\n");
}
