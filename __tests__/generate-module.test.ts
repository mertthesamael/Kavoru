import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  generateModule,
  toCamelCase,
  toModuleSlug,
  toPascalCase,
  toTagLabel,
} from "../scripts/generate-module";

describe("generate-module naming", () => {
  it("slugifies module names", () => {
    expect(toModuleSlug("User Profile")).toBe("user-profile");
    expect(toModuleSlug("users")).toBe("users");
  });

  it("builds pascal, camel, and tag labels", () => {
    expect(toPascalCase("user-profile")).toBe("UserProfile");
    expect(toCamelCase("user-profile")).toBe("userProfile");
    expect(toTagLabel("user-profile")).toBe("User Profile");
  });
});

describe("generate-module scaffold", () => {
  let tempRoot = "";

  afterEach(() => {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = "";
    }
  });

  it("generates CRUD routes, service, types, and schemas", async () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "kavoru-generate-module-"));
    const projectDir = path.join(tempRoot, "project");
    const scriptsDir = path.join(projectDir, "scripts");
    const modulesDir = path.join(projectDir, "src/modules");
    const schemasDir = path.join(projectDir, "src/models/schemas");

    await mkdirSync(scriptsDir, { recursive: true });
    await Bun.write(
      path.join(scriptsDir, "generate-route-registry.ts"),
      'console.log("skip registry");\n',
    );

    const slug = await generateModule("billing", { projectDir });
    expect(slug).toBe("billing");

    const routes = readFileSync(
      path.join(modulesDir, "billing/routes.ts"),
      "utf8",
    );
    const service = readFileSync(
      path.join(modulesDir, "billing/service.ts"),
      "utf8",
    );
    const types = readFileSync(
      path.join(modulesDir, "billing/types.ts"),
      "utf8",
    );
    const schema = readFileSync(
      path.join(schemasDir, "billing.ts"),
      "utf8",
    );

    expect(existsSync(path.join(modulesDir, "billing/routes.ts"))).toBe(true);
    expect(existsSync(path.join(schemasDir, "billing.ts"))).toBe(true);

    expect(routes).toContain('.get("/", ({ query }) => BillingService.list(query)');
    expect(routes).toContain('.get("/:id"');
    expect(routes).toContain('.post("/",');
    expect(routes).toContain('.put("/:id"');
    expect(routes).toContain('.delete("/:id"');
    expect(routes).toContain("billingListQuerySchema");
    expect(routes).toContain("createBillingSchema");
    expect(routes).toContain("updateBillingSchema");
    expect(routes).toContain("billingParamsSchema");

    expect(schema).toContain("export const billingListQuerySchema");
    expect(schema).toContain("export const createBillingSchema");
    expect(schema).toContain("export const updateBillingSchema");
    expect(schema).toContain("export const billingParamsSchema");

    expect(service).toContain("export abstract class BillingService");
    expect(service).toContain("static list(");
    expect(service).toContain("static create(");
    expect(service).toContain("static update(");
    expect(service).toContain("static remove(");

    expect(types).toContain("export namespace Billing");
  });
});
