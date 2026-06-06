import { readFileSync } from "node:fs";
import path from "node:path";
import { generateModule } from "./generate-module";

const packageVersion = readFileSync(
  path.join(import.meta.dir, "../package.json"),
  "utf8",
);
const version = (JSON.parse(packageVersion) as { version: string }).version;

const HELP = `\
Usage: kavoru <command> [options]

Project CLI for Kavoru apps.

Commands:
  module <name>   Generate src/modules/<name> (routes, service, types)

Options:
  -h, --help      Show help
  -V, --version   Show version

Examples:
  kavoru module users
  kavoru module user-profile --force
  bun run kavoru module billing
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
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

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
    default:
      throw new Error(`Unknown command "${command}". Run "kavoru --help".`);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
