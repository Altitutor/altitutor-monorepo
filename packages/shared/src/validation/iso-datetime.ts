// Retain the API's Zod 3.25.76 datetime grammar: calendar-valid dates, optional
// seconds, and (where allowed) either +09:30 or +0930 offsets. Keep the UTC-only
// contract distinct, and validate without normalizing callers' timestamps.
// Grammar adapted from Zod's MIT-licensed v3 datetimeRegex.
const date = String.raw`((\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\d|3[01])|(0[469]|11)-(0[1-9]|[12]\d|30)|(02)-(0[1-9]|1\d|2[0-8])))`;
const time = String.raw`([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?`;

export const ISO_DATETIME_UTC_PATTERN = new RegExp(`^${date}T${time}Z$`);
export const ISO_DATETIME_OFFSET_PATTERN = new RegExp(
  `^${date}T${time}(Z|([+-]\\d{2}:?\\d{2}))$`,
);
