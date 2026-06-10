import Elysia from "elysia";
import { getRedisStatus } from "../../infra/redis";
import {
  createRedisEntrySchema,
  redisListQuerySchema,
  redisParamsSchema,
  updateRedisEntrySchema,
} from "../../models/schemas/redis";
import { RedisService } from "./service";

export default new Elysia({
  name: "redis",
  prefix: "/redis",
  tags: ["Redis"],
})
  .get("/status", () => getRedisStatus())
  .get("/", ({ query }) => RedisService.list(query), {
    query: redisListQuerySchema,
  })
  .get("/:key", ({ params }) => RedisService.get(params.key), {
    params: redisParamsSchema,
  })
  .post("/", ({ body }) => RedisService.set(body), {
    body: createRedisEntrySchema,
  })
  .put("/:key", ({ params, body }) => RedisService.update(params.key, body), {
    params: redisParamsSchema,
    body: updateRedisEntrySchema,
  })
  .delete("/:key", ({ params }) => RedisService.remove(params.key), {
    params: redisParamsSchema,
  });
