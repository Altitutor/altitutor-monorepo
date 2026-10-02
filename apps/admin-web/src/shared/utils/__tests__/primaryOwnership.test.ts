import { ownedPrimaryHref, primaryTrail } from "../primaryOwnership";
const id = "11111111-1111-1111-1111-111111111111";
const child = "22222222-2222-2222-2222-222222222222";
test("single-owner paths carry a durable breadcrumb trail", () => {
  for (const [parent, entity] of [
    ["classes", "sessions"],
    ["students", "invoices"],
    ["subjects", "topics"],
  ]) {
    const href = ownedPrimaryHref(
      `/${entity}/${child}`,
      `/${parent}/${id}`,
      new URLSearchParams(),
    );
    expect(
      primaryTrail(
        `/${entity}/${child}`,
        new URL(href, "http://local").searchParams,
      ),
    ).toEqual([`/${parent}/${id}`]);
  }
});
test("many-to-many links and lists do not inherit a trail", () => {
  expect(
    ownedPrimaryHref(
      `/students/${child}`,
      `/classes/${id}`,
      new URLSearchParams(),
    ),
  ).toBe(`/students/${child}`);
  expect(
    ownedPrimaryHref("/sessions", `/classes/${id}`, new URLSearchParams()),
  ).toBe("/sessions");
  expect(
    primaryTrail(
      `/students/${child}`,
      new URLSearchParams({ trail: JSON.stringify([`/classes/${id}`]) }),
    ),
  ).toEqual([]);
});
