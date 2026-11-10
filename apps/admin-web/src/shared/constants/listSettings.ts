export interface ListSettingsLink {
  title: string;
  href: string;
}

function deleted(kind: string, title = "Deleted entities"): ListSettingsLink {
  return { title, href: `/settings/deleted-records?kind=${kind}` };
}

const scheduling: ListSettingsLink[] = [
  { title: "Opening hours", href: "/settings/opening-hours" },
  { title: "Blockout dates", href: "/settings/blockouts" },
  { title: "Booking settings", href: "/settings/booking" },
];

const richText: ListSettingsLink[] = [
  { title: "Rich text templates", href: "/settings/rich-text-templates" },
];

export const listSettingsLinks = {
  mail: [{ title: "Email", href: "/settings/email" }],
  students: [
    { title: "Duplicate students", href: "/settings/duplicate-students" },
    deleted("student"),
  ],
  messages: [
    { title: "Messaging", href: "/settings/messaging" },
    { title: "Message templates", href: "/settings/templates" },
    { title: "Call routing", href: "/settings/call-routing" },
    { title: "Phone numbers", href: "/settings/phone-numbers" },
    { title: "Contacts", href: "/settings/contacts" },
    { title: "Automation rules", href: "/settings/automation" },
  ],
  staff: [
    { title: "Blockout dates", href: "/settings/blockouts" },
    { title: "Pay tiers", href: "/settings/pay-tiers" },
    deleted("staff"),
  ],
  classes: [
    ...scheduling,
    deleted("class", "Deleted classes"),
    deleted("admin_shift", "Deleted admin shifts"),
  ],
  sessions: [...scheduling, deleted("session")],
  parents: [deleted("parent")],
  tasks: [...richText, deleted("task")],
  projects: [...richText, deleted("project")],
  issues: [...richText, deleted("issue")],
  documents: [
    { title: "Office print", href: "/settings/office-print" },
    deleted("document", "Deleted documents"),
    deleted("folder", "Deleted folders"),
  ],
} as const satisfies Record<string, readonly ListSettingsLink[]>;

export type ListSettingsKey = keyof typeof listSettingsLinks;
