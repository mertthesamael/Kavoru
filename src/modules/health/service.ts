import { echoResponseSchema } from "../../models/schemas/health";

export abstract class HealtService {
  static echo(message: string): Promise<typeof echoResponseSchema.static> {
    return Promise.resolve({
      message: message === "ping" ? "pong" : message,
    });
  }
}
