#!/usr/bin/env bun

import { runKavoruCli } from "../scripts/kavoru-cli.ts";

await runKavoruCli(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
