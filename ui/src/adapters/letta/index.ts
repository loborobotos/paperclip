import type { UIAdapterModule } from "../types";
import { parseLettaStdoutLine } from "./parse-stdout";
import { LettaConfigFields } from "./config-fields";
import { buildLettaConfig } from "./build-config";

export const lettaUIAdapter: UIAdapterModule = {
  type: "letta",
  label: "Letta (Cloud Agent)",
  parseStdoutLine: parseLettaStdoutLine,
  ConfigFields: LettaConfigFields,
  buildAdapterConfig: buildLettaConfig,
};
