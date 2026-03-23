import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

export const lettaAdapter: ServerAdapterModule = {
  type: "letta",
  execute,
  testEnvironment,
  models: [
    { id: "letta-cloud", label: "Letta Cloud (via LettaBot)" },
    { id: "letta-direct", label: "Letta Cloud (direct API)" },
  ],
  agentConfigurationDoc: `# Letta adapter configuration

Adapter: letta

Connects Paperclip agents to Letta Cloud stateful agents, optionally via LettaBot bridge.

## Connection Modes

### lettabot (default, recommended)
Routes messages through LettaBot running in the same Railway project.
Uses internal networking for low-latency, no public exposure.

Required fields:
- lettabotAgentName (string): Agent name in LettaBot config
- lettabotUrl (string, optional): LettaBot endpoint, default http://lettabot.railway.internal:8080
- lettabotApiKey (string, optional): LettaBot API key (use secret:LETTABOT_API_KEY)

### direct
Calls Letta Cloud API directly. Useful when LettaBot is not available.

Required fields:
- lettaAgentId (string): Letta Cloud agent UUID
- lettaBaseUrl (string, optional): Letta API base URL, default https://api.letta.ai
- lettaApiKey (string): Letta Cloud API key (use secret:LETTA_API_KEY)

## Common fields
- connectionMode (string): "lettabot" or "direct", default "lettabot"
- timeoutMs (number, optional): request timeout in milliseconds, default 120000
`,
};
