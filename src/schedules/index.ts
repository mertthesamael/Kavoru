import Elysia from "elysia";
import { cron, Patterns } from "@elysia/cron";
import { logger } from "../common/logger";

export const schedules = new Elysia()
  .use(
    cron({
      name: "Daily Schedule",
      pattern: Patterns.everyDayAt("00:00"),
      timezone: "Europe/Istanbul",
      run: () => {
        logger.info("Daily schedule");
      },
    }),
  )
  .use(
    cron({
      name: "Spesific Day Schedule",
      pattern: Patterns.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT,
      timezone: "UTC",
      run: () => {
        logger.info("Spesific Day Schedule");
      },
    }),
  )
  .use(
    cron({
      name: "Cron Example",
      pattern: "*/10 * * * * *",
      run: () => {
        logger.info("Heartbeat Cron");
      },
    }),
  );
