# Letta Adapter for Paperclip — Integration Plan

## Goal
Build a custom Paperclip adapter (`letta`) that connects Paperclip agents to Letta Cloud via LettaBot, enabling cloud-based autonomous agent execution.

## Architecture

```
Paperclip (Railway)
  └─ Agent (adapter: letta)
       │
       ├─ Heartbeat / Task assignment
       │
       └─ POST → LettaBot API (Railway internal networking)
                  │
                  └─ POST → Letta Cloud API
                             │
                             └─ Agent executes (stateful, persistent memory)
                                  │
                                  └─ Response flows back
```

## Components

### 1. Paperclip Adapter: `adapter-letta`

New package: `@paperclipai/adapter-letta`

**Adapter config schema:**
```typescript
{
  adapterType: "letta",
  adapterConfig: {
    // Letta Cloud agent ID
    lettaAgentId: "agent-e47d832c-4758-4ece-9859-0681f5ec173a",
    
    // Connection mode: "direct" (Letta API) or "lettabot" (via LettaBot)
    connectionMode: "lettabot",
    
    // LettaBot endpoint (internal Railway networking)
    lettabotUrl: "http://lettabot.railway.internal:8080",
    
    // LettaBot agent name (as registered in lettabot config)
    lettabotAgentName: "Lobo Roboto",
    
    // Direct mode: Letta API base URL
    lettaBaseUrl: "https://api.letta.ai",
    
    // Secret reference for API key
    lettaApiKey: "secret:LETTA_API_KEY",
    
    // Secret reference for LettaBot API key  
    lettabotApiKey: "secret:LETTABOT_API_KEY",
  }
}
```

**Adapter interface implementation:**
- `sendMessage(agentId, message)` → POST to Letta Cloud or LettaBot
- `getStatus(agentId)` → Check agent health
- `listModels()` → Return available Letta models
- `testEnvironment(config)` → Verify connectivity

### 2. LettaBot Bridge Endpoint

Add to LettaBot (`loboroboto/lettabot`):

**New endpoint:** `POST /api/v1/paperclip/message`

```typescript
// Request from Paperclip
{
  agentName: "Lobo Roboto",
  message: "Execute task: ...",
  context: {
    companyId: "...",
    issueId: "...",
    runId: "...",
  }
}

// Response back to Paperclip
{
  status: "ok",
  response: "Task completed. PR created at ...",
  artifacts: [...],
}
```

### 3. Secrets Integration

Use Paperclip's built-in secrets management:
- `LETTA_API_KEY` → Stored as company secret
- `LETTABOT_API_KEY` → Stored as company secret
- Referenced in adapterConfig as `secret:KEY_NAME`
- Resolved at runtime by Paperclip's `secretService`

## Implementation Steps

### Phase 1: Minimal Viable Adapter (MVP)

1. **Create `packages/adapter-letta/`** in Paperclip fork
   - `package.json` with `@paperclipai/adapter-letta`
   - `src/index.ts` — Adapter registration
   - `src/client.ts` — Letta Cloud API client
   - `src/lettabot-client.ts` — LettaBot API client
   - `src/adapter.ts` — Paperclip adapter interface implementation

2. **Register adapter** in Paperclip's adapter registry
   - Add to `server/src/adapters/index.ts`
   - Add UI card for adapter selection

3. **Test locally**
   - Create agent with `letta` adapter
   - Send test message
   - Verify round-trip

### Phase 2: LettaBot Bridge

4. **Add Paperclip endpoint to LettaBot**
   - `POST /api/v1/paperclip/message`
   - Auth via shared secret
   - Forward to Letta Cloud agent
   - Return response

5. **Internal networking**
   - Paperclip → LettaBot via `lettabot.railway.internal:8080`
   - No public exposure needed

### Phase 3: Full Integration

6. **Heartbeat support**
   - Paperclip scheduler triggers heartbeat
   - Adapter sends heartbeat message to Letta agent
   - Agent executes autonomous work
   - Response recorded in Paperclip

7. **Issue assignment**
   - Paperclip assigns issue to Letta agent
   - Adapter sends issue context
   - Agent works on issue (git, code, PR)
   - Status updates flow back to Paperclip

8. **Cost tracking**
   - Track Letta API token usage
   - Report back to Paperclip cost_events
   - Budget enforcement via Paperclip policies

## File Structure

```
paperclip/
├── packages/
│   └── adapter-letta/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts          # Adapter registration + exports
│           ├── adapter.ts        # ServerAdapter implementation
│           ├── client.ts         # Letta Cloud API client
│           ├── lettabot-client.ts # LettaBot API client
│           ├── schema.ts         # Zod schemas for config
│           └── types.ts          # TypeScript types
├── server/src/adapters/
│   └── index.ts                  # Add letta adapter registration
└── client/src/
    └── components/
        └── adapters/
            └── letta/            # UI components for adapter config
```

## Railway Environment

```
Services (same project):
  ├── Postgres (database)
  ├── paperclip (governance) — port 3100
  ├── lettabot (agent runtime) — port 8080
  └── (future) letta-server (self-hosted, Phase 3+)

Internal networking:
  paperclip → lettabot.railway.internal:8080
  paperclip → postgres.railway.internal:5432
```

## Current State

- [x] Paperclip deployed and healthy on Railway
- [x] LettaBot deployed and healthy on Railway  
- [x] Postgres deployed and healthy on Railway
- [x] Company "Lobo Roboto and Co" created
- [x] CEO agent created (process adapter — placeholder)
- [x] Fork paperclipai/paperclip → loborobotos/paperclip
- [ ] Create adapter-letta package
- [ ] Register adapter in Paperclip
- [ ] Add LettaBot bridge endpoint
- [ ] Reconfigure CEO to use letta adapter
- [ ] Test end-to-end

## References

- Paperclip upstream: paperclipai/paperclip
- Paperclip fork: loborobotos/paperclip
- Existing adapters: `packages/adapter-claude-local/`, `packages/adapter-codex-local/`
- LettaBot API: `POST /api/v1/chat` (existing), new: `POST /api/v1/paperclip/message`
- Letta Cloud API: `POST /v1/agents/{id}/messages`
