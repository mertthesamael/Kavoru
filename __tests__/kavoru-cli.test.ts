import { describe, expect, it } from "bun:test";
import path from "node:path";

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
  });

  it("rejects unknown commands", () => {
    const result = Bun.spawnSync({
      cmd: ["bun", cliPath, "unknown"],
      cwd: projectRoot,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('Unknown command "unknown"');
  });
});
