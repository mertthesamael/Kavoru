import { Resend } from "resend";
import { config } from "../../config";

let client: Resend | null = null;

export function getResendClient() {
  if (!config.env.resend.enabled) return null;

  if (!client) {
    client = new Resend(config.env.resend.apiKey);
  }

  return client;
}

export function resetResendClient() {
  client = null;
}
