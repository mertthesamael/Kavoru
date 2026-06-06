import { loadEnv } from "./env";

type LoadedEnv = ReturnType<typeof loadEnv>;

let cachedEnv: LoadedEnv | undefined;

function getEnv(): LoadedEnv {
  cachedEnv ??= loadEnv();
  return cachedEnv;
}

export const config = {
  get env(): LoadedEnv {
    return getEnv();
  },
  version: "1.0.0",
};
