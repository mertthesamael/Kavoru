import { existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  buildPrismaSchemaContent,
  buildRepositoryContent,
  generateRepository,
} from "../scripts/generate-repository";

describe("generate-repository", () => {
  let tempRoot = "";

  afterEach(() => {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = "";
    }
  });

  it("builds prisma schema with id-only model", () => {
    expect(buildPrismaSchemaContent("User")).toBe(`model User {
  id String @id @default(uuid())
}
`);
  });

  it("builds repository with CRUD and transaction helpers", () => {
    const content = buildRepositoryContent("User", "user");
    expect(content).toContain("export abstract class UserRepository");
    expect(content).toContain("static findById");
    expect(content).toContain("static findMany");
    expect(content).toContain("static create");
    expect(content).toContain("static update");
    expect(content).toContain("static delete");
    expect(content).toContain("static replaceIdInTransaction");
    expect(content).toContain("prisma.$transaction");
    expect(content).toContain("prisma.user.findUnique");
  });

  it("generates schema and repository files when prisma is enabled", async () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "kavoru-generate-repository-"));
    const projectDir = path.join(tempRoot, "project");
    const schemaDir = path.join(projectDir, "src/infra/prisma/schemas");
    mkdirSync(schemaDir, { recursive: true });

    await Bun.write(
      path.join(projectDir, "prisma.config.ts"),
      'export default { schema: "src/infra/prisma/schemas" };\n',
    );
    await Bun.write(
      path.join(schemaDir, "schema.prisma"),
      `generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}
datasource db {
  provider = "postgresql"
}
`,
    );

    const slug = await generateRepository("billing", {
      projectDir,
      force: true,
      skipGenerate: true,
    });

    expect(slug).toBe("billing");
    expect(
      existsSync(path.join(schemaDir, "billing.prisma")),
    ).toBe(true);
    expect(
      existsSync(
        path.join(projectDir, "src/infra/prisma/repositories/billing.ts"),
      ),
    ).toBe(true);
  });

  it("rejects when prisma is not enabled", async () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "kavoru-generate-repository-"));
    const projectDir = path.join(tempRoot, "project");
    mkdirSync(projectDir, { recursive: true });

    await expect(generateRepository("user", { projectDir })).rejects.toThrow(
      "PostgreSQL/Prisma is not enabled",
    );
  });
});
