import { logger } from "../../../common/logger";

const main = async () => {
  // Frist delete exist collections, then create new ones.
  try {
  } catch (err) {
    throw err;
  }
};

main().catch((err) => {
  logger.error("Error While generating Seed", { err });
  process.exit(1);
});
