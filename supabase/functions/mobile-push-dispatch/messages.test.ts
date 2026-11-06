import { assertEquals } from "jsr:@std/assert";
import { batchPushDeliveries, messageFor } from "./messages.ts";

const tutor = {
  app_scope: "staff_web",
  category: "tutor_updates",
  expo_push_token: "ExpoPushToken[tutor]",
  notification_id: "1171a7d6-059b-4d69-ac71-00f968bb51c7",
  title: "Private staff title",
  body: "Private student information",
} as const;

Deno.test("tutor pushes use a generic banner and route to the matching inbox item", () => {
  assertEquals(messageFor(tutor), {
    to: "ExpoPushToken[tutor]",
    title: "Tutor update",
    body: "Open Altitutor Tutor to view an inbox update.",
    data: { destination: "inbox", notificationId: "1171a7d6-059b-4d69-ac71-00f968bb51c7" },
    sound: "default",
    channelId: "tutor-updates",
  });
});

Deno.test("devices from separate Expo projects are sent in separate batches", () => {
  const student = {
    app_scope: "student_web",
    category: "sessions",
    expo_push_token: "ExpoPushToken[student]",
    notification_id: "student-notification",
  } as const;
  const ucat = {
    app_scope: "ucat_web",
    category: "new_content",
    expo_push_token: "ExpoPushToken[ucat]",
    notification_id: "ucat-notification",
  } as const;
  const secondTutor = { ...tutor, expo_push_token: "ExpoPushToken[other-tutor]" };

  assertEquals(batchPushDeliveries([tutor, student, ucat, secondTutor]), [
    [student],
    [ucat],
    [tutor, secondTutor],
  ]);
  assertEquals(messageFor(student).data, { destination: "classes" });
  assertEquals(messageFor(ucat).data, { destination: "inbox" });
});
