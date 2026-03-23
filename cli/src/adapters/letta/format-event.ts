export function printLettaStdoutEvent(raw: string, _debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  // Color-code [letta] prefixed lines
  if (line.startsWith("[letta] Error:")) {
    console.error(`\x1b[31m${line}\x1b[0m`);
  } else if (line.startsWith("[letta] Sending")) {
    console.log(`\x1b[36m${line}\x1b[0m`);
  } else if (line.startsWith("[letta] Response:")) {
    console.log(`\x1b[32m${line}\x1b[0m`);
  } else {
    console.log(line);
  }
}
