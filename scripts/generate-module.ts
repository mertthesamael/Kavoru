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

function buildSchemaFile(camel: string, pascal: string): string {
  return `import { t } from "elysia";

export const ${camel}ParamsSchema = t.Object({
  id: t.String({ minLength: 1 }),
});

export const ${camel}ListQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
  search: t.Optional(t.String()),
});

export const create${pascal}Schema = t.Object({
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
});

export const update${pascal}Schema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  description: t.Optional(t.String()),
});

export const ${camel}Schema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.Optional(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const ${camel}ListSchema = t.Object({
  items: t.Array(${camel}Schema),
  total: t.Number(),
  page: t.Number(),
  limit: t.Number(),
});

export const delete${pascal}ResponseSchema = t.Object({
  id: t.String(),
});
`;
}

function buildRoutesFile(slug: string, tag: string, camel: string, pascal: string): string {
  return `import Elysia from "elysia";
import {
  create${pascal}Schema,
  ${camel}ListQuerySchema,
  ${camel}ParamsSchema,
  update${pascal}Schema,
} from "../../models/schemas/${slug}";
import { ${pascal}Service } from "./service";

export default new Elysia({
  name: "${slug}",
  prefix: "/${slug}",
  tags: ["${tag}"],
})
  .get("/", ({ query }) => ${pascal}Service.list(query), {
    query: ${camel}ListQuerySchema,
  })
  .get("/:id", ({ params }) => ${pascal}Service.findById(params.id), {
    params: ${camel}ParamsSchema,
  })
  .post("/", ({ body }) => ${pascal}Service.create(body), {
    body: create${pascal}Schema,
  })
  .put("/:id", ({ params, body }) => ${pascal}Service.update(params.id, body), {
    params: ${camel}ParamsSchema,
    body: update${pascal}Schema,
  })
  .delete("/:id", ({ params }) => ${pascal}Service.remove(params.id), {
    params: ${camel}ParamsSchema,
  });
`;
}

function buildServiceFile(slug: string, camel: string, pascal: string): string {
  const mockStore = `mock${pascal}Items`;

  return `import { status } from "elysia";
import type { Static } from "elysia";
import type {
  create${pascal}Schema,
  ${camel}ListQuerySchema,
  ${camel}ListSchema,
  ${camel}Schema,
  delete${pascal}ResponseSchema,
  update${pascal}Schema,
} from "../../models/schemas/${slug}";

export type ${pascal}Entity = Static<typeof ${camel}Schema>;
export type Create${pascal}Input = Static<typeof create${pascal}Schema>;
export type Update${pascal}Input = Static<typeof update${pascal}Schema>;
export type ${pascal}ListQuery = Static<typeof ${camel}ListQuerySchema>;

const ${mockStore}: ${pascal}Entity[] = [
  {
    id: "1",
    name: "Sample ${toTagLabel(slug)}",
    description: "Replace with real data from your database",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export abstract class ${pascal}Service {
  static list(query: ${pascal}ListQuery): Static<typeof ${camel}ListSchema> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim().toLowerCase();

    let items = ${mockStore};
    if (search) {
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(search) ||
          item.description?.toLowerCase().includes(search),
      );
    }

    const total = items.length;
    const start = (page - 1) * limit;

    return {
      items: items.slice(start, start + limit),
      total,
      page,
      limit,
    };
  }

  static findById(id: string): ${pascal}Entity {
    const item = ${mockStore}.find((entry) => entry.id === id);
    if (!item) {
      throw status(404, "${pascal} not found");
    }
    return item;
  }

  static create(input: Create${pascal}Input): ${pascal}Entity {
    const now = new Date().toISOString();
    const item: ${pascal}Entity = {
      id: String(${mockStore}.length + 1),
      name: input.name,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };

    ${mockStore}.push(item);
    return item;
  }

  static update(id: string, input: Update${pascal}Input): ${pascal}Entity {
    const index = ${mockStore}.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw status(404, "${pascal} not found");
    }

    const updated: ${pascal}Entity = {
      ...${mockStore}[index]!,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    ${mockStore}[index] = updated;
    return updated;
  }

  static remove(id: string): Static<typeof delete${pascal}ResponseSchema> {
    const index = ${mockStore}.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw status(404, "${pascal} not found");
    }

    ${mockStore}.splice(index, 1);
    return { id };
  }
}
`;
}

function buildTypesFile(camel: string, pascal: string, slug: string): string {
  return `import type { Static } from "elysia";
import type {
  create${pascal}Schema,
  ${camel}ListQuerySchema,
  ${camel}Schema,
  update${pascal}Schema,
} from "../../models/schemas/${slug}";

export namespace ${pascal} {
  export type Entity = Static<typeof ${camel}Schema>;
  export type CreateInput = Static<typeof create${pascal}Schema>;
  export type UpdateInput = Static<typeof update${pascal}Schema>;
  export type ListQuery = Static<typeof ${camel}ListQuerySchema>;
}
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
  const schemaPath = path.join(projectDir, "src/models/schemas", `${slug}.ts`);

  if (existsSync(moduleDir) && !options.force) {
    throw new Error(
      `Module "${slug}" already exists at src/modules/${slug}. Use --force to overwrite.`,
    );
  }

  if (existsSync(schemaPath) && !options.force) {
    throw new Error(
      `Schema "${slug}" already exists at src/models/schemas/${slug}.ts. Use --force to overwrite.`,
    );
  }

  const pascal = toPascalCase(slug);
  const camel = toCamelCase(slug);
  const tag = toTagLabel(slug);

  await mkdir(moduleDir, { recursive: true });
  await mkdir(path.dirname(schemaPath), { recursive: true });

  await Bun.write(schemaPath, buildSchemaFile(camel, pascal));
  await Bun.write(
    path.join(moduleDir, "routes.ts"),
    buildRoutesFile(slug, tag, camel, pascal),
  );
  await Bun.write(
    path.join(moduleDir, "service.ts"),
    buildServiceFile(slug, camel, pascal),
  );
  await Bun.write(
    path.join(moduleDir, "types.ts"),
    buildTypesFile(camel, pascal, slug),
  );

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
  console.log(`Created schema "src/models/schemas/${slug}.ts"`);
}

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
