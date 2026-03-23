import type { CLIAdapterModule } from "@paperclipai/adapter-utils";
import { printLettaStdoutEvent } from "./format-event.js";

export const lettaCLIAdapter: CLIAdapterModule = {
  type: "letta",
  formatStdoutEvent: printLettaStdoutEvent,
};
