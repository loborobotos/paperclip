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

Connects Paperclip agents to Letta Cloud stateful agents. Letta agents have persistent memory,
conversation history, and tool access managed by the Letta platform.

Use when:
- The agent needs persistent memory across runs (Letta agents retain state automatically)
- You have existing Letta Cloud agents you want to orchestrate via Paperclip
- The agent needs tools managed by LettaBot (Bash, GitHub, web search, etc.)
- You want Railway internal networking between Paperclip and LettaBot (lettabot mode)

Don't use when:
- You need a simple one-shot script execution (use the "process" adapter instead)
- You need an HTTP webhook callback (use the "http" adapter instead)
- The agent needs to run a local CLI tool like Claude Code or Codex (use claude_local / codex_local)
- You need streaming transcript output (Letta responses are not streamed through this adapter)

## Connection Modes

### lettabot (default, recommended)
Routes messages through LettaBot running in the same Railway project.
Uses internal networking for low-latency, no public exposure.

Required fields:
- connectionMode (string): "lettabot"
- lettabotAgentName (string): Agent name in LettaBot config (must match YAML agent entry)
- lettabotUrl (string, optional): LettaBot endpoint, default http://lettabot.railway.internal:8080
- lettabotApiKey (string, optional): LettaBot API bearer token (use secret:LETTABOT_API_KEY)
- timeoutMs (number, optional): request timeout in milliseconds, default 120000

### direct
Calls Letta Cloud API directly. Useful when LettaBot is not available or for lightweight agents
that don't need LettaBot's tool capabilities.

Required fields:
- connectionMode (string): "direct"
- lettaAgentId (string): Letta Cloud agent UUID
- lettaBaseUrl (string, optional): Letta API base URL, default https://api.letta.ai
- lettaApiKey (string): Letta Cloud API key (use secret:LETTA_API_KEY)
- timeoutMs (number, optional): request timeout in milliseconds, default 120000

## Notes
- Letta agents are stateful — they maintain their own memory and conversation history.
  Unlike CLI adapters (claude_local, codex_local), there is no session codec because
  Letta manages sessions internally. Each execution sends a new message to the agent's
  existing conversation thread.
- The adapter injects Paperclip context (run ID, task ID, wake reason, linked issues)
  into the message body so the Letta agent can use it.
- Timeouts should be generous (120s+) because Letta agents may invoke tools (Bash, web search)
  that take significant time.
`,
};
