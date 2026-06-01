import { config } from "../../config";
import { logger } from "../../common/logger";
import { getResendClient } from "./client";
import type { SendEmailInput } from "./types";

export type { SendEmailInput } from "./types";

export function isResendEnabled() {
  return config.env.resend.enabled;
}

export async function sendEmail(input: SendEmailInput) {
  const client = getResendClient();
  if (!client) {
    throw new Error("Resend client unavailable");
  }

  const from = input.from ?? config.env.resend.from;
  if (!from) {
    throw new Error("Sender address is not configured");
  }

  if (!input.html && !input.text) {
    throw new Error("Either html or text body is required");
  }

  const body =
    input.html !== undefined
      ? input.text !== undefined
        ? { html: input.html, text: input.text }
        : { html: input.html }
      : { text: input.text! };

  const { data, error } = await client.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    ...body,
    ...(input.replyTo !== undefined ? { replyTo: input.replyTo } : {}),
  });

  if (error) {
    logger.error("Resend send failed", { error });
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Resend returned no message id");
  }

  return { id: data.id };
}
