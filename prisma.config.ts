import "dotenv/config";
import { defineConfig } from "prisma/config";
import { config } from "./src/config";

export default defineConfig({
  schema: "src/infra/prisma/schemas/schema",
  datasource: {
    url: config.env.database.url,
  },
  migrations: {
    path: "src/infra/prisma/migrations",
    seed: "src/infra/prisma/seed/index.ts",
  },
});
