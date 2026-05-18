import Elysia from "elysia";
import { colorLevel, logger } from "../common/logger";
import { PERF_START_HEADER } from "../constants/headers";

export const telemetryMiddleware = new Elysia({
  name: "telemetry",
  tags: ["Telemetry"],
})
  .onRequest(({ set }) => {
    set.headers[PERF_START_HEADER] = performance.now().toFixed(8);
  })
  .onAfterHandle(({ set, request }) => {
    const startRaw = set.headers[PERF_START_HEADER];
    if (typeof startRaw !== "string") return;

    const pathname = new URL(request.url).pathname;
    const ms = (performance.now() - Number(startRaw)).toFixed(8);
    logger.info(
      `Response time ${colorLevel("info", ms)} ms ${colorLevel("debug", pathname)}`,
    );
  })
  .derive(async ({ request, server, headers }) => {
    const IP = server?.requestIP(request) || { address: "", family: "IPv4" };
    const userAgent = headers["user-agent"] || "";
    const referer = headers["referer"] || "";
    const host = headers["host"] || "";
    const method = request.method;
    const path = new URL(request.url).pathname;
    logger.info(`Method: ${colorLevel("info", method)}`);
    logger.info(`Path: ${colorLevel("info", path)}`);
    logger.info(`IP: ${colorLevel("info", IP.address)}`);
    logger.info(`User-Agent: ${colorLevel("info", userAgent)}`);
    logger.info(`Referer: ${colorLevel("info", referer)}`);
    logger.info(`Host: ${colorLevel("info", host)}`);

    return {
      IP,
      userAgent,
      referer,
      host,
      method,
      path,
    };
  })
  .as("scoped");
