import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import {
  authenticateBearer,
  extractChatIdentifier,
  monotonicAppleService,
  monotonicStatus,
  parseAppleService,
  parseIMessageEvent,
  statusRank,
  timingSafeEqual,
  validateCommandRequest,
} from "../imessage.ts";
import {
  connectorOutcome,
  normalizeCompletionResult,
  normalizeHeartbeatStatus,
} from "../imessage-connector.ts";
import fixture from "./fixtures/imessage-bridge-contract.json" with {
  type: "json",
};

describe("iMessage authentication", () => {
  it("compares equal secrets and rejects length differences", () => {
    expect(timingSafeEqual("connector-secret", "connector-secret")).toBe(true);
    expect(timingSafeEqual("connector-secret", "connector-secrex")).toBe(false);
    expect(timingSafeEqual("short", "longer")).toBe(false);
  });

  it("requires the bearer scheme and exact secret", () => {
    expect(authenticateBearer("Bearer secret", "secret")).toBe(true);
    expect(authenticateBearer("secret", "secret")).toBe(false);
    expect(authenticateBearer("Bearer wrong", "secret")).toBe(false);
    expect(authenticateBearer("Bearer ", "")).toBe(false);
  });
});

describe("iMessage event dispatch parsing", () => {
  it("normalizes bridge event aliases", () => {
    expect(parseIMessageEvent({ type: "message", guid: "guid-1" }).eventType)
      .toBe("new-message");
    expect(
      parseIMessageEvent({ EventType: "read-receipt", MessageGuid: "guid-1" })
        .eventType,
    )
      .toBe("read");
    expect(
      parseIMessageEvent({ eventType: "delivery-status", guid: "guid-1" })
        .eventType,
    ).toBe("delivery");
    expect(parseIMessageEvent({ EventType: "updated-message" }).eventType)
      .toBe("delivery");
    expect(
      parseIMessageEvent({ EventType: "chat-read-status-changed" }).eventType,
    ).toBe("read");
    expect(parseIMessageEvent({ EventType: "group-name-change" }).eventType)
      .toBe("group-name-changed");
    expect(parseIMessageEvent({ EventType: "participant-left" }).eventType)
      .toBe("participant-removed");
    expect(parseIMessageEvent({ EventType: "server-url-change" }).eventType)
      .toBe("server");
    expect(
      parseIMessageEvent({ eventType: "typing-indicator", eventId: "event-1" })
        .eventType,
    )
      .toBe("typing");
  });

  it("classifies unknown events as ignored system events", () => {
    expect(parseIMessageEvent({ type: "contact-updated" }).eventType).toBe(
      "system",
    );
  });

  it("derives the same replay key for the same GUID event", () => {
    const first = parseIMessageEvent({
      type: "reconciliation-message",
      connectorId: "mac-1",
      guid: "guid-1",
      body: "hello",
    });
    const replay = parseIMessageEvent({
      type: "reconciliation-message",
      connectorId: "mac-1",
      guid: "guid-1",
      body: "hello",
    });
    expect(first.eventKey).toBe(replay.eventKey);
  });

  it("versions updated-message keys without breaking exact replay dedupe", () => {
    const delivered = parseIMessageEvent(fixture.updatedDelivered);
    const deliveredReplay = parseIMessageEvent(
      structuredClone(fixture.updatedDelivered),
    );
    const read = parseIMessageEvent(fixture.updatedRead);
    expect(delivered.eventKey).toBe(deliveredReplay.eventKey);
    expect(delivered.eventKey).not.toBe(read.eventKey);
  });

  it("extracts recipients from ChatGuid values", () => {
    expect(extractChatIdentifier("iMessage;-;+61400000000")).toBe(
      "+61400000000",
    );
    expect(extractChatIdentifier("iMessage;+;chat123")).toBe("chat123");
  });
});

describe("bridge connector contract", () => {
  it("matches the claim command envelope", () => {
    const command = fixture.claimResponse.commands[0];
    expect(Object.keys(command).sort()).toEqual([
      "attempts",
      "id",
      "payload",
      "type",
    ]);
    expect(command.payload.mediaUrls.every((url) => typeof url === "string"))
      .toBe(true);
  });

  it("accepts outcome and normalizes the actual send result", () => {
    expect(connectorOutcome(fixture.completionRequest.outcome)).toBe(
      "succeeded",
    );
    const result = normalizeCompletionResult(
      fixture.completionRequest.result,
    );
    expect(result.guid).toBe("provider-guid");
    expect(result.tempGuid).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(result.messageId).toBe("12345");
    expect(result.sentAt).toBe("2026-07-17T07:45:00.000Z");
  });

  it("sanitizes the authoritative heartbeat shape", () => {
    const heartbeat = normalizeHeartbeatStatus(
      fixture.heartbeatRequest.status,
    );
    expect(heartbeat.status).toBe("healthy");
    expect(heartbeat.capabilities).toEqual([
      "bluebubbles",
      "private-api",
      "webhook",
    ]);
    expect(heartbeat.metrics.outboxPending).toBe(2);
    expect(heartbeat.metrics.lastForwardedAt).toBe(1784274300000);
    expect(heartbeat.metrics).not.toHaveProperty("serverInfo");
  });
});

describe("connector realtime session helpers", () => {
  it("derives a stable password material from the connector secret", async () => {
    const { connectorRealtimePassword, IMESSAGE_CONNECTOR_WAKE_TOPIC } =
      await import("../imessage-connector-realtime.ts");
    const first = await connectorRealtimePassword("secret", "mac-1");
    const second = await connectorRealtimePassword("secret", "mac-1");
    const other = await connectorRealtimePassword("secret", "mac-2");
    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(IMESSAGE_CONNECTOR_WAKE_TOPIC).toBe("imessage:connector:wake");
  });
});

describe("iMessage status mapping", () => {
  it("never regresses delivered or read messages", () => {
    expect(monotonicStatus("DELIVERED", "SENT")).toBe("DELIVERED");
    expect(monotonicStatus("READ", "DELIVERED")).toBe("READ");
    expect(monotonicStatus("AMBIGUOUS", "SENT")).toBe("SENT");
    expect(monotonicStatus("SENT", "FAILED")).toBe("FAILED");
    expect(monotonicStatus("DELIVERED", "FAILED")).toBe("DELIVERED");
    expect(statusRank("READ")).toBeGreaterThan(statusRank("DELIVERED"));
  });
});

describe("Apple service from inbox events", () => {
  it("persists webhook Service SMS and iMessage", () => {
    expect(parseAppleService({ service: "SMS" })).toBe("SMS");
    expect(parseAppleService({ service: "iMessage" })).toBe("iMessage");
  });

  it("falls back to Chat GUID prefix only when Service is omitted", () => {
    expect(parseAppleService({ chatGuid: "SMS;-;+61400000000" })).toBe("SMS");
    expect(parseAppleService({ chatGuid: "iMessage;-;+61400000000" })).toBe(
      "iMessage",
    );
    expect(
      parseAppleService({ service: "SMS", chatGuid: "iMessage;-;+61400000000" }),
    ).toBe("SMS");
    expect(parseAppleService({ chatGuid: "any;-;+61400000000" })).toBeNull();
  });

  it("fills unknown then keeps a known value when a later event omits service", () => {
    expect(monotonicAppleService(null, "SMS")).toBe("SMS");
    expect(monotonicAppleService("iMessage", null)).toBe("iMessage");
    expect(monotonicAppleService("SMS", "iMessage")).toBe("SMS");
  });
});

describe("iMessage control validation", () => {
  it("accepts a non-destructive read command without a reason", () => {
    const parsed = validateCommandRequest({
      commandType: "mark_chat_read",
      conversationId: "conversation-1",
      payload: {},
    });
    expect(parsed.commandType).toBe("mark_chat_read");
    expect(parsed.reason).toBeNull();
  });

  it("requires a reason for destructive commands", () => {
    expect(() =>
      validateCommandRequest({
        commandType: "delete_message",
        messageId: "message-1",
        payload: {},
      })
    ).toThrow("reason");
  });

  it("validates command-specific payload fields", () => {
    expect(() =>
      validateCommandRequest({
        commandType: "add_participant",
        conversationId: "conversation-1",
        payload: {},
      })
    ).toThrow("payload.participant");
    expect(
      validateCommandRequest({
        commandType: "react",
        messageId: "message-1",
        payload: { reaction: "love" },
      }).payload.reaction,
    ).toBe("love");
  });
});
