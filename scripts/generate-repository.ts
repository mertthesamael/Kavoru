import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  toCamelCase,
  toModuleSlug,
  toPascalCase,
} from "./generate-module";

export function buildPrismaSchemaContent(pascal: string): string {
  return `model ${pascal} {
  id String @id @default(uuid())
}
`;
}

export function buildRepositoryContent(pascal: string, camel: string): string {
  return `import { prisma } from "../client";
import type { Prisma } from "../generated/prisma/client";

export type ${pascal}CreateInput = Prisma.${pascal}CreateInput;
export type ${pascal}UpdateInput = Prisma.${pascal}UpdateInput;

export abstract class ${pascal}Repository {
  static findById(id: string) {
    return prisma.${camel}.findUnique({ where: { id } });
  }

  static findMany() {
    return prisma.${camel}.findMany({ orderBy: { id: "asc" } });
  }

  static create(data: ${pascal}CreateInput = {}) {
    return prisma.${camel}.create({ data });
  }

  static update(id: string, data: ${pascal}UpdateInput) {
    return prisma.${camel}.update({ where: { id }, data });
  }

  static delete(id: string) {
    return prisma.${camel}.delete({ where: { id } });
  }

  static replaceIdInTransaction(currentId: string, nextId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.${camel}.findUnique({ where: { id: currentId } });
      if (!existing) {
        return null;
      }

      await tx.${camel}.delete({ where: { id: currentId } });
      return tx.${camel}.create({ data: { id: nextId } });
    });
  }
}
`;
}

function assertPrismaEnabled(projectDir: string): void {
  const prismaConfig = path.join(projectDir, "prisma.config.ts");
  const prismaRoot = path.join(projectDir, "src/infra/prisma");
  const schemaRoot = path.join(prismaRoot, "schemas");
  const baseSchema = path.join(schemaRoot, "schema.prisma");

  if (!existsSync(prismaConfig) || !existsSync(prismaRoot) || !existsSync(baseSchema)) {
    throw new Error(
      "PostgreSQL/Prisma is not enabled. Scaffold with the postgres feature or add prisma.config.ts and src/infra/prisma/schemas/schema.prisma.",
    );
  }
}

async function runPrismaGenerate(projectDir: string): Promise<void> {
  const proc = Bun.spawnSync({
    cmd: ["bunx", "prisma", "generate"],
    cwd: projectDir,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (proc.exitCode !== 0) {
    throw new Error("Failed to run bunx prisma generate");
  }
}

export type GenerateRepositoryOptions = {
  projectDir?: string;
  force?: boolean;
  skipGenerate?: boolean;
};

export async function generateRepository(
  rawName: string,
  options: GenerateRepositoryOptions = {},
): Promise<string> {
  const slug = toModuleSlug(rawName);
  if (!slug) {
    throw new Error("Repository name cannot be empty.");
  }
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error(
      `"${rawName}" is not a valid repository name. Use lowercase letters, numbers, and hyphens.`,
    );
  }

  const projectDir = options.projectDir ?? process.cwd();
  assertPrismaEnabled(projectDir);

  const pascal = toPascalCase(slug);
  const camel = toCamelCase(slug);
  const schemaPath = path.join(
    projectDir,
    "src/infra/prisma/schemas",
    `${slug}.prisma`,
  );
  const repositoryPath = path.join(
    projectDir,
    "src/infra/prisma/repositories",
    `${slug}.ts`,
  );

  if (existsSync(schemaPath) && !options.force) {
    throw new Error(
      `Prisma schema "${slug}" already exists at src/infra/prisma/schemas/${slug}.prisma. Use --force to overwrite.`,
    );
  }

  if (existsSync(repositoryPath) && !options.force) {
    throw new Error(
      `Repository "${slug}" already exists at src/infra/prisma/repositories/${slug}.ts. Use --force to overwrite.`,
    );
  }

  await mkdir(path.dirname(repositoryPath), { recursive: true });
  await Bun.write(schemaPath, buildPrismaSchemaContent(pascal));
  await Bun.write(repositoryPath, buildRepositoryContent(pascal, camel));

  if (!options.skipGenerate) {
    await runPrismaGenerate(projectDir);
  }

  return slug;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const force = args.includes("--force") || args.includes("-f");
  const name = args.find((arg) => !arg.startsWith("-"));

  if (!name) {
    throw new Error(
      "Usage: bun run scripts/generate-repository.ts <repository-name> [--force]",
    );
  }

  const slug = await generateRepository(name, { force });
  console.log(`Created schema "src/infra/prisma/schemas/${slug}.prisma"`);
  console.log(`Created repository "src/infra/prisma/repositories/${slug}.ts"`);
}

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
