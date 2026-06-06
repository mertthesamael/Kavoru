import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export function toModuleSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toPascalCase(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");
}

export function toCamelCase(slug: string): string {
  const pascal = toPascalCase(slug);
  return pascal[0]!.toLowerCase() + pascal.slice(1);
}

export function toTagLabel(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

function buildRoutesFile(slug: string, tag: string): string {
  return `import { Elysia } from "elysia";

export default new Elysia({
  name: "${slug}",
  prefix: "/${slug}",
  tags: ["${tag}"],
}).get("/", () => {
  return {
    message: "Hello World",
  };
});
`;
}

function buildServiceFile(pascal: string, camel: string): string {
  return `export class ${pascal}Service {}

export const ${camel}Service = new ${pascal}Service();
`;
}

function buildTypesFile(pascal: string): string {
  return `export namespace ${pascal} {}
`;
}

export type GenerateModuleOptions = {
  projectDir?: string;
  force?: boolean;
};

export async function generateModule(
  rawName: string,
  options: GenerateModuleOptions = {},
): Promise<string> {
  const slug = toModuleSlug(rawName);
  if (!slug) {
    throw new Error("Module name cannot be empty.");
  }
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error(
      `"${rawName}" is not a valid module name. Use lowercase letters, numbers, and hyphens.`,
    );
  }

  const projectDir = options.projectDir ?? process.cwd();
  const moduleDir = path.join(projectDir, "src/modules", slug);

  if (existsSync(moduleDir) && !options.force) {
    throw new Error(
      `Module "${slug}" already exists at src/modules/${slug}. Use --force to overwrite.`,
    );
  }

  const pascal = toPascalCase(slug);
  const camel = toCamelCase(slug);
  const tag = toTagLabel(slug);

  await mkdir(moduleDir, { recursive: true });
  await Bun.write(path.join(moduleDir, "routes.ts"), buildRoutesFile(slug, tag));
  await Bun.write(
    path.join(moduleDir, "service.ts"),
    buildServiceFile(pascal, camel),
  );
  await Bun.write(path.join(moduleDir, "types.ts"), buildTypesFile(pascal));

  const registryScript = path.join(projectDir, "scripts/generate-route-registry.ts");
  if (existsSync(registryScript)) {
    const proc = Bun.spawnSync({
      cmd: ["bun", "run", registryScript],
      cwd: projectDir,
      stdout: "inherit",
      stderr: "inherit",
    });
    if (proc.exitCode !== 0) {
      throw new Error("Failed to regenerate routes.registry.ts");
    }
  }

  return slug;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const force = args.includes("--force") || args.includes("-f");
  const name = args.find((arg) => !arg.startsWith("-"));

  if (!name) {
    throw new Error("Usage: bun run scripts/generate-module.ts <module-name> [--force]");
  }

  const slug = await generateModule(name, { force });
  console.log(`Created module "src/modules/${slug}"`);
}

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
