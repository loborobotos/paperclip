import type { TranscriptEntry } from "../types";

export function parseLettaStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  // Parse [letta] prefixed log lines
  if (trimmed.startsWith("[letta] Response:")) {
    const text = trimmed.replace("[letta] Response: ", "");
    return [{ kind: "assistant", ts, text }];
  }

  if (trimmed.startsWith("[letta] Sending")) {
    return [{ kind: "system", ts, text: trimmed }];
  }

  if (trimmed.startsWith("[letta] Error:")) {
    return [{ kind: "stderr", ts, text: trimmed }];
  }

  return [{ kind: "stdout", ts, text: trimmed }];
}
