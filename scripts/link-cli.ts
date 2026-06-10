import {
  chmodSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

function resolveBunBinDir(): string {
  const bunInstall = process.env.BUN_INSTALL ?? path.join(homedir(), ".bun");
  return path.join(bunInstall, "bin");
}

function writeUnixShim(shimPath: string, binScript: string): void {
  const escaped = binScript.replace(/\\/g, "/").replace(/"/g, '\\"');
  writeFileSync(
    shimPath,
    `#!/usr/bin/env sh\nexec bun "${escaped}" "$@"\n`,
    "utf8",
  );
  chmodSync(shimPath, 0o755);
}

export function linkProjectCli(
  projectRoot = path.join(import.meta.dir, ".."),
): string {
  const binScript = path.resolve(projectRoot, "bin/kavoru.js");
  if (!existsSync(binScript)) {
    throw new Error(
      "Project CLI not found. Ensure bin/kavoru.js exists (cli feature enabled).",
    );
  }

  const bunBinDir = resolveBunBinDir();
  mkdirSync(bunBinDir, { recursive: true });

  if (process.platform === "win32") {
    for (const name of ["kavoru.exe", "kavoru.bunx"]) {
      const existing = path.join(bunBinDir, name);
      if (existsSync(existing)) {
        rmSync(existing, { force: true });
      }
    }

    const cmdPath = path.join(bunBinDir, "kavoru.cmd");
    const escapedCmd = binScript.replace(/"/g, '""');
    writeFileSync(cmdPath, `@echo off\r\nbun "${escapedCmd}" %*\r\n`, "utf8");

    const shPath = path.join(bunBinDir, "kavoru");
    writeUnixShim(shPath, binScript);
    return shPath;
  }

  const shimPath = path.join(bunBinDir, "kavoru");
  writeUnixShim(shimPath, binScript);
  return shimPath;
}

if (import.meta.main) {
  if (process.env.CI === "true" || process.env.CI === "1") {
    process.exit(0);
  }

  const projectRoot = path.join(import.meta.dir, "..");
  const binScript = path.resolve(projectRoot, "bin/kavoru.js");
  if (!existsSync(binScript)) {
    process.exit(0);
  }

  const linked = linkProjectCli(projectRoot);
  console.log(`Linked ${linked} -> ${binScript}`);
}
