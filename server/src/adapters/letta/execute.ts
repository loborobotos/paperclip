import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString, asNumber, parseObject } from "../utils.js";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config } = ctx;

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
  const { config, runId, agent, context, onLog, onMeta } = ctx;

  const lettabotUrl = asString(config.lettabotUrl, "http://lettabot.railway.internal:8080");
  const lettabotAgentName = asString(config.lettabotAgentName, agent.name);
  const lettabotApiKey = asString(config.lettabotApiKey, "");
  const timeoutMs = asNumber(config.timeoutMs, 120000);

  const endpoint = `${lettabotUrl.replace(/\/$/, "")}/api/v1/chat`;

  // Build the message with Paperclip context
  const message = buildMessage(context, runId, agent);

  // Emit invocation metadata
  if (onMeta) {
    await onMeta({
      adapterType: "letta",
      command: `POST ${endpoint}`,
      commandNotes: [
        `connectionMode: lettabot`,
        `agent: ${lettabotAgentName}`,
        `timeoutMs: ${timeoutMs}`,
      ],
      prompt: message,
      context,
    });
  }

  await onLog("stdout", `[letta] Sending to LettaBot agent "${lettabotAgentName}"...\n`);

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
      const errMsg = `LettaBot invoke failed with status ${res.status}: ${errorText.slice(0, 500)}`;
      await onLog("stderr", `[letta] ${errMsg}\n`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: errMsg,
        errorCode: `letta_lettabot_http_${res.status}`,
      };
    }

    const responseText = await res.text();
    await onLog("stdout", `[letta] Response: ${responseText.slice(0, 2000)}\n`);

    let responseData: Record<string, unknown> = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // Response may not be JSON; that's OK
    }

    const summary = typeof responseData.response === "string"
      ? (responseData.response as string).slice(0, 500)
      : responseText.slice(0, 500);

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary: `LettaBot → ${lettabotAgentName}: ${summary}`,
      resultJson: responseData,
      provider: "letta",
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const errMsg = `LettaBot request timed out after ${timeoutMs}ms`;
      await onLog("stderr", `[letta] ${errMsg}\n`);
      return {
        exitCode: 1,
        signal: "SIGTERM",
        timedOut: true,
        errorMessage: errMsg,
        errorCode: "letta_timeout",
      };
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    await onLog("stderr", `[letta] Error: ${errMsg}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: errMsg,
      errorCode: "letta_lettabot_error",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Execute directly against Letta Cloud API.
 * Paperclip → Letta Cloud → Agent
 */
async function executeDirectLetta(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, runId, agent, context, onLog, onMeta } = ctx;

  const lettaBaseUrl = asString(config.lettaBaseUrl, "https://api.letta.ai");
  const lettaAgentId = asString(config.lettaAgentId, "");
  const lettaApiKey = asString(config.lettaApiKey, "");
  const timeoutMs = asNumber(config.timeoutMs, 120000);

  if (!lettaAgentId) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "Letta adapter (direct mode) requires lettaAgentId",
      errorCode: "letta_missing_agent_id",
    };
  }
  if (!lettaApiKey) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "Letta adapter (direct mode) requires lettaApiKey",
      errorCode: "letta_missing_api_key",
    };
  }

  const endpoint = `${lettaBaseUrl.replace(/\/$/, "")}/v1/agents/${lettaAgentId}/messages`;
  const message = buildMessage(context, runId, agent);

  // Emit invocation metadata
  if (onMeta) {
    await onMeta({
      adapterType: "letta",
      command: `POST ${endpoint}`,
      commandNotes: [
        `connectionMode: direct`,
        `agentId: ${lettaAgentId}`,
        `timeoutMs: ${timeoutMs}`,
      ],
      prompt: message,
      context,
    });
  }

  await onLog("stdout", `[letta] Sending direct to Letta Cloud agent ${lettaAgentId}...\n`);

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
      const errMsg = `Letta Cloud invoke failed with status ${res.status}: ${errorText.slice(0, 500)}`;
      await onLog("stderr", `[letta] ${errMsg}\n`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: errMsg,
        errorCode: `letta_cloud_http_${res.status}`,
      };
    }

    const responseText = await res.text();
    await onLog("stdout", `[letta] Response: ${responseText.slice(0, 2000)}\n`);

    let responseData: Record<string, unknown> = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // Response may not be JSON
    }

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary: `Letta Cloud → ${lettaAgentId}: ${responseText.slice(0, 500)}`,
      resultJson: responseData,
      provider: "letta",
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const errMsg = `Letta Cloud request timed out after ${timeoutMs}ms`;
      await onLog("stderr", `[letta] ${errMsg}\n`);
      return {
        exitCode: 1,
        signal: "SIGTERM",
        timedOut: true,
        errorMessage: errMsg,
        errorCode: "letta_timeout",
      };
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    await onLog("stderr", `[letta] Error: ${errMsg}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: errMsg,
      errorCode: "letta_cloud_error",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Build a structured message from Paperclip execution context.
 * Context fields per Paperclip convention: taskId, wakeReason, issueIds, etc.
 */
function buildMessage(
  context: Record<string, unknown>,
  runId: string,
  agent: AdapterExecutionContext["agent"],
): string {
  const parts: string[] = [];

  parts.push(`[Paperclip Task | Run: ${runId} | Agent: ${agent.name}]`);

  // Wake reason
  const wakeReason = context.wakeReason as string | undefined;
  if (wakeReason) {
    parts.push(`Wake reason: ${wakeReason}`);
  }

  // Task/issue context
  const taskId = (context.taskId ?? context.issueId) as string | undefined;
  if (taskId) {
    parts.push(`Task ID: ${taskId}`);
  }

  const issueIds = context.issueIds as string | undefined;
  if (issueIds) {
    parts.push(`Linked issues: ${issueIds}`);
  }

  // Approval context
  const approvalId = context.approvalId as string | undefined;
  const approvalStatus = context.approvalStatus as string | undefined;
  if (approvalId) {
    parts.push(`Approval: ${approvalId} (${approvalStatus ?? "pending"})`);
  }

  // Comment context
  const commentId = (context.wakeCommentId ?? context.commentId) as string | undefined;
  if (commentId) {
    parts.push(`Comment ID: ${commentId}`);
  }

  // Prompt (the actual task instruction)
  const prompt = context.prompt as string | undefined;
  if (prompt) {
    parts.push(`\nTask:\n${prompt}`);
  }

  // Parent messages for conversation context
  const parentMessages = context.parentMessages as Array<{ role: string; content: unknown }> | undefined;
  if (parentMessages && parentMessages.length > 0) {
    parts.push(`\nConversation context (last ${Math.min(parentMessages.length, 5)} messages):`);
    for (const msg of parentMessages.slice(-5)) {
      const content = typeof msg.content === "string"
        ? msg.content.slice(0, 500)
        : JSON.stringify(msg.content).slice(0, 500);
      parts.push(`  [${msg.role}]: ${content}`);
    }
  }

  return parts.join("\n");
}
