const appScopes = ["student_web", "ucat_web", "staff_web"] as const;

export type PushRecipient = {
  app_scope: (typeof appScopes)[number];
  category: string;
  expo_push_token: string;
  notification_id: string;
};

export function batchPushDeliveries<T extends PushRecipient>(deliveries: T[]): T[][] {
  // Expo rejects a send request containing devices from different projects.
  return appScopes.map((scope) =>
    deliveries.filter((delivery) => delivery.app_scope === scope)
  ).filter((batch) => batch.length > 0);
}

const channels = {
  student_web: "student-updates",
  ucat_web: "ucat-updates",
  staff_web: "tutor-updates",
};

const ucatCopy: Record<string, { title: string; body: string }> = {
  payments: { title: "Payment update", body: "Open Altitutor UCAT to view a payment update." },
  referrals: { title: "Referral update", body: "Open Altitutor UCAT to view a referral update." },
  quota_grants: { title: "Quota updated", body: "Your UCAT allowance has been updated." },
  quota_limits: { title: "Quota alert", body: "Open Altitutor UCAT to view your allowance." },
  new_content: { title: "New UCAT content", body: "New practice content is available." },
};

function contentFor(delivery: PushRecipient) {
  switch (delivery.app_scope) {
    case "student_web":
      return delivery.category === "sessions"
        ? { title: "Session update", body: "A session update is available.", data: { destination: "classes" } }
        : { title: "Payment needs attention", body: "Open Altitutor to view an update.", data: { destination: "billing" } };
    case "ucat_web":
      return { ...ucatCopy[delivery.category], data: { destination: "inbox" } };
    case "staff_web":
      return {
        title: "Tutor update",
        body: "Open Altitutor Tutor to view an inbox update.",
        data: { destination: "inbox", notificationId: delivery.notification_id },
      };
  }
}

export function messageFor(delivery: PushRecipient) {
  return {
    to: delivery.expo_push_token,
    ...contentFor(delivery),
    sound: "default",
    channelId: channels[delivery.app_scope],
  };
}
