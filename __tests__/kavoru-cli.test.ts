import { describe, expect, it } from "bun:test";
import path from "node:path";
import { isProjectCommand } from "../scripts/kavoru-cli";

const projectRoot = path.join(import.meta.dir, "..");
const cliPath = path.join(projectRoot, "scripts/kavoru-cli.ts");

describe("kavoru cli", () => {
  it("prints help", () => {
    const result = Bun.spawnSync({
      cmd: ["bun", cliPath, "--help"],
      cwd: projectRoot,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("kavoru module");
    expect(result.stdout.toString()).toContain("kavoru my-api");
  });

  it("recognizes project-only commands", () => {
    expect(isProjectCommand("module")).toBe(true);
    expect(isProjectCommand("repository")).toBe(true);
    expect(isProjectCommand("my-api")).toBe(false);
  });
});
