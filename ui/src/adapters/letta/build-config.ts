import type { CreateConfigValues } from "../../components/AgentConfigForm";

export function buildLettaConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};

  // Default to lettabot mode
  ac.connectionMode = "lettabot";

  // Use the URL field for lettabotUrl if provided
  if (v.url) {
    ac.lettabotUrl = v.url;
  } else {
    ac.lettabotUrl = "http://lettabot.railway.internal:8080";
  }

  ac.timeoutMs = 120000;

  return ac;
}
