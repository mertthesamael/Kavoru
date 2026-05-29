import Elysia from "elysia";
import { echoSchema } from "../../models/schemas/health";
import { HealtService } from "./service";
import { InternalServerError } from "../../models/errors/http-error";
export default new Elysia({
  name: "health",
  prefix: "/healthz",
  tags: ["Health Check"],
})
  .get("/", () => "ok")
  .get("/error", () => {
    throw InternalServerError("Test Error");
  })
  .post(
    "/echo",
    ({ body }) => {
      return HealtService.echo(body.message);
    },
    {
      body: echoSchema,
    },
  );
