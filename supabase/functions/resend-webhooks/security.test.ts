import { assertEquals, assertThrows } from "jsr:@std/assert";
import { Webhook } from "npm:svix@1.76.1";
import { verifyResendWebhook } from "./security.ts";

Deno.test("verifies the untouched raw body with Svix", () => {
  const secret = "whsec_dGVzdC13ZWJob29rLXNlY3JldA==";
  const id = "msg_test_123";
  const timestamp = new Date();
  const rawBody = '{"type":"email.delivered","data":{"email_id":"email_1"}}';
  const webhook = new Webhook(secret);
  const signature = webhook.sign(id, timestamp, rawBody);

  assertEquals(
    verifyResendWebhook(rawBody, {
      id,
      timestamp: Math.floor(timestamp.getTime() / 1_000).toString(),
      signature,
    }, secret),
    JSON.parse(rawBody),
  );
});

Deno.test("rejects a payload changed after signing", () => {
  const secret = "whsec_dGVzdC13ZWJob29rLXNlY3JldA==";
  const id = "msg_test_456";
  const timestamp = new Date();
  const webhook = new Webhook(secret);
  const signature = webhook.sign(id, timestamp, '{"safe":true}');

  assertThrows(() =>
    verifyResendWebhook('{"safe":false}', {
      id,
      timestamp: Math.floor(timestamp.getTime() / 1_000).toString(),
      signature,
    }, secret)
  );
});
