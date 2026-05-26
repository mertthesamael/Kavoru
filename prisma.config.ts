import "dotenv/config";
import { defineConfig } from "prisma/config";
import { config } from "./src/config";

export default defineConfig({
  schema: "src/infra/prisma/schema",
  datasource: {
    url: config.env.database.url ?? "postgresql://localhost:5432/postgres",
  },
  migrations: {
    path: "src/infra/prisma/migrations",
    seed: "src/infra/prisma/seed/index.ts",
  },
});
