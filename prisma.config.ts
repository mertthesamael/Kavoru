import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "src/infra/prisma/schemas",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: "src/infra/prisma/migrations",
    seed: "src/infra/prisma/seed/index.ts",
  },
});
