import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function LettaConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="LettaBot Agent Name" hint="The agent name in your LettaBot YAML config">
        <DraftInput
          value={
            isCreate
              ? values!.url
              : eff("adapterConfig", "lettabotAgentName", String(config.lettabotAgentName ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ url: v })
              : mark("adapterConfig", "lettabotAgentName", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="Lobo Roboto"
        />
      </Field>
      <Field label="LettaBot URL" hint="Internal URL to LettaBot service (Railway internal networking)">
        <DraftInput
          value={
            isCreate
              ? values!.url
              : eff("adapterConfig", "lettabotUrl", String(config.lettabotUrl ?? "http://lettabot.railway.internal:8080"))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ url: v })
              : mark("adapterConfig", "lettabotUrl", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="http://lettabot.railway.internal:8080"
        />
      </Field>
    </>
  );
}
