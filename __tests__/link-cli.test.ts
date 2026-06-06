import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { linkProjectCli } from "../scripts/link-cli";

describe("link-cli", () => {
  let tempRoot = "";
  let previousBunInstall = process.env.BUN_INSTALL;

  afterEach(() => {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = "";
    }

    if (previousBunInstall === undefined) {
      delete process.env.BUN_INSTALL;
    } else {
      process.env.BUN_INSTALL = previousBunInstall;
    }
  });

  it("writes a shim that points at bin/kavoru.js", () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "kavoru-link-cli-"));
    process.env.BUN_INSTALL = tempRoot;

    const projectRoot = path.join(tempRoot, "project");
    mkdirSync(path.join(projectRoot, "bin"), { recursive: true });
    writeStub(projectRoot);

    const linked = linkProjectCli(projectRoot);
    expect(existsSync(linked)).toBe(true);

    const shim = readFileSync(linked, "utf8");
    expect(shim).toContain(path.join(projectRoot, "bin", "kavoru.js"));
  });
});

function writeStub(projectRoot: string): void {
  const binPath = path.join(projectRoot, "bin", "kavoru.js");
  Bun.write(binPath, "#!/usr/bin/env bun\n");
}
