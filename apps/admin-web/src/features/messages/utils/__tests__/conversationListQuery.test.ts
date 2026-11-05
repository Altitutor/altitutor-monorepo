import { matchesConversationListQuery, type ConversationListQueryFields } from "../conversationListQuery";

const fields: ConversationListQueryFields = {
  names: ["Ada Student"],
  phones: ["+61478778288"],
  unread: true,
  unreplied: true,
  followUp: false,
  assignedStaffId: "ada",
  recipientType: "STUDENT",
  ownedNumberIds: ["number-1"],
};

const query = { search: "", filters: {}, staffId: "ada" };

it("matches an assigned unread student on the built-in views", () => {
  expect(matchesConversationListQuery(fields, query)).toBe(true);
  expect(matchesConversationListQuery(fields, { ...query, filters: { read: ["unread"] } })).toBe(true);
  expect(matchesConversationListQuery(fields, { ...query, filters: { assignee: ["mine"] } })).toBe(true);
  expect(matchesConversationListQuery(fields, { ...query, filters: { reply: ["unreplied"] } })).toBe(true);
  expect(matchesConversationListQuery(fields, { ...query, filters: { followUp: ["yes"] } })).toBe(false);
});

it("filters recipient type, read state, and the sending number", () => {
  expect(matchesConversationListQuery(fields, { ...query, filters: { recipient: ["PARENT"] } })).toBe(false);
  expect(matchesConversationListQuery(fields, { ...query, filters: { read: ["read"] } })).toBe(false);
  expect(matchesConversationListQuery(fields, { ...query, filters: { from: ["number-2"] } })).toBe(false);
  expect(matchesConversationListQuery(fields, { ...query, filters: { from: ["number-1"] } })).toBe(true);
});

it("matches a local mobile search against an international number", () => {
  expect(matchesConversationListQuery(fields, { ...query, search: "0478778288" })).toBe(true);
  expect(matchesConversationListQuery(fields, { ...query, search: "Bea" })).toBe(false);
});
