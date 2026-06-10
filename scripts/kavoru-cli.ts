import { readFileSync } from "node:fs";
import path from "node:path";
import { generateModule } from "./generate-module";
import { generateRepository } from "./generate-repository";

const packageVersion = readFileSync(
  path.join(import.meta.dir, "../package.json"),
  "utf8",
);
const version = (JSON.parse(packageVersion) as { version: string }).version;

const HELP = `\
Usage: kavoru <command|directory> [options]

Project CLI for Kavoru apps. Scaffold commands delegate to bunx kavoru@latest.

Commands:
  module <name>        Generate CRUD module + src/models/schemas/<name>.ts
  repository <name>    Generate Prisma schema + repository (requires postgres)

Scaffold:
  kavoru <directory>              Create a new project
  kavoru . --features auth,cli    Scaffold in current directory

Options:
  -h, --help      Show help
  -V, --version   Show version

Examples:
  kavoru module users
  kavoru repository user
  kavoru my-api
  bunx kavoru@latest my-api       # explicit scaffold (always works)
`;

function printHelp(): void {
  console.log(HELP.trim());
}

function printVersion(): void {
  console.log(version);
}

async function runModuleCommand(argv: string[]): Promise<void> {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(`\
Usage: kavoru module <module-name> [options]

Generate a feature module under src/modules/<module-name>/ with:
  routes.ts, service.ts, types.ts
  src/models/schemas/<module-name>.ts (query, body, params schemas)

Options:
  -f, --force   Overwrite an existing module folder
  -h, --help    Show help

Examples:
  kavoru module users
  kavoru module user-profile --force
`);
    return;
  }

  const force = argv.includes("--force") || argv.includes("-f");
  const name = argv.find((arg) => !arg.startsWith("-"));

  if (!name) {
    throw new Error("Usage: kavoru module <module-name> [--force]");
  }

  const slug = await generateModule(name, { force });
  console.log(`Created module "src/modules/${slug}"`);
  console.log(`Created schema "src/models/schemas/${slug}.ts"`);
}

async function runRepositoryCommand(argv: string[]): Promise<void> {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(`\
Usage: kavoru repository <repository-name> [options]

Generate Prisma model + repository (requires postgres/prisma feature):
  src/infra/prisma/schemas/<name>.prisma
  src/infra/prisma/repositories/<name>.ts

Runs bunx prisma generate when finished.

Options:
  -f, --force   Overwrite existing schema/repository files
  -h, --help    Show help

Examples:
  kavoru repository user
  kavoru repository billing --force
`);
    return;
  }

  const force = argv.includes("--force") || argv.includes("-f");
  const name = argv.find((arg) => !arg.startsWith("-"));

  if (!name) {
    throw new Error("Usage: kavoru repository <repository-name> [--force]");
  }

  const slug = await generateRepository(name, { force });
  console.log(`Created schema "src/infra/prisma/schemas/${slug}.prisma"`);
  console.log(`Created repository "src/infra/prisma/repositories/${slug}.ts"`);
}

export function isProjectCommand(command: string): boolean {
  return command === "module" || command === "repository";
}

async function forwardToScaffoldCli(argv: string[]): Promise<void> {
  const proc = Bun.spawn(["bunx", "kavoru@latest", ...argv], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    process.exit(exitCode ?? 1);
  }
}

export async function runKavoruCli(argv = process.argv.slice(2)): Promise<void> {
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    printHelp();
    return;
  }

  if (argv.includes("-V") || argv.includes("--version")) {
    printVersion();
    return;
  }

  const [command, ...rest] = argv;
  if (!command) {
    printHelp();
    return;
  }

  switch (command) {
    case "module":
      await runModuleCommand(rest);
      return;
    case "repository":
      await runRepositoryCommand(rest);
      return;
    default:
      if (!isProjectCommand(command)) {
        await forwardToScaffoldCli(argv);
        return;
      }
      throw new Error(`Unknown command "${command}". Run "kavoru --help".`);
  }
}

if (import.meta.main) {
  runKavoruCli().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
