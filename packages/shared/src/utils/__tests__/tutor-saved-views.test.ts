import type { DataTableState } from "../../types/data-table";
import type { QuickFilter } from "../../types/quick-filters";
import { encodeViewConfig, type DisplaySettings } from "../saved-views";
import {
  applySavedViewToTableState,
  assertTutorViewWrite,
  tutorCanReadSavedView,
  tutorDefaultDisplaySettings,
  tutorViewEntity,
  withBuiltinSavedView,
} from "../tutor-saved-views";

const actor = "00000000-0000-0000-0000-000000000010";
const other = "00000000-0000-0000-0000-000000000011";
const defaults: DisplaySettings = tutorDefaultDisplaySettings(["name"]);

function viewConfig(settings: Partial<DisplaySettings> = {}) {
  return encodeViewConfig({ ...defaults, ...settings });
}

describe("tutor saved views", () => {
  it("names a tutor page entity without colliding with admin entities", () => {
    expect(tutorViewEntity("ucat_students")).toBe("tutor:ucat_students");
    expect(tutorViewEntity("students")).toBe("tutor:students");
    expect(() => tutorViewEntity("Students")).toThrow(/page key/);
    expect(() => tutorViewEntity("tutor:ucat_students")).toThrow(/page key/);
  });

  it("lets a tutor read shared tutor views and their own, and nothing else", () => {
    expect(
      tutorCanReadSavedView(
        { target_entity: "tutor:ucat_students", user_id: null },
        actor,
      ),
    ).toBe(true);
    expect(
      tutorCanReadSavedView(
        { target_entity: "tutor:ucat_students", user_id: actor },
        actor,
      ),
    ).toBe(true);
    expect(
      tutorCanReadSavedView(
        { target_entity: "tutor:ucat_students", user_id: other },
        actor,
      ),
    ).toBe(false);
    expect(
      tutorCanReadSavedView({ target_entity: "students", user_id: null }, actor),
    ).toBe(false);
    expect(
      tutorCanReadSavedView({ target_entity: "students", user_id: actor }, actor),
    ).toBe(false);
  });

  it("rejects writes that leave the tutor entity or assign another person", () => {
    const config = viewConfig({ filters: { status: ["active"] } });
    expect(
      assertTutorViewWrite({
        actorId: actor,
        existing: null,
        next: {
          name: "  Active  ",
          target_entity: "tutor:interview_stations",
          user_id: null,
          config,
        },
      }),
    ).toEqual({
      ok: true,
      row: {
        name: "Active",
        target_entity: "tutor:interview_stations",
        user_id: null,
        config,
      },
    });

    expect(
      assertTutorViewWrite({
        actorId: actor,
        existing: null,
        next: {
          name: "Mine",
          target_entity: "tutor:ucat_students",
          user_id: other,
          config: viewConfig(),
        },
      }).ok,
    ).toBe(false);

    expect(
      assertTutorViewWrite({
        actorId: actor,
        existing: { target_entity: "tutor:ucat_students", user_id: actor },
        next: {
          name: "Moved",
          target_entity: "students",
          user_id: actor,
          config: viewConfig(),
        },
      }).ok,
    ).toBe(false);

    expect(
      assertTutorViewWrite({
        actorId: actor,
        existing: { target_entity: "tutor:ucat_students", user_id: other },
        next: {
          name: "Theirs",
          target_entity: "tutor:ucat_students",
          user_id: actor,
          config: viewConfig(),
        },
      }).ok,
    ).toBe(false);

    expect(
      assertTutorViewWrite({
        actorId: actor,
        existing: { target_entity: "tutor:ucat_students", user_id: null },
        next: {
          name: "Shared renamed",
          target_entity: "tutor:ucat_students",
          user_id: null,
          config: viewConfig(),
        },
      }).ok,
    ).toBe(true);
  });

  it("puts the page default ahead of saved views", () => {
    const saved: QuickFilter = {
      id: "saved-1",
      name: "Private",
      target_entity: "tutor:ucat_students",
      user_id: actor,
      created_at: "2026-10-28T00:00:00.000Z",
      updated_at: "2026-10-28T00:00:00.000Z",
      config: viewConfig({ sortBy: "name", sortDirection: "asc" }),
    };
    const views = withBuiltinSavedView("tutor:ucat_students", [saved], {
      name: "All",
      settings: defaults,
    });
    expect(views.map((view) => view.name)).toEqual(["All", "Private"]);
    expect(views[0]?.id).toBe("builtin:tutor:ucat_students:default");
    expect(
      withBuiltinSavedView("tutor:ucat_students", undefined, {
        name: "All",
        settings: defaults,
      })[0]?.name,
    ).toBe("All");
  });

  it("applies a saved view's filters, sort, columns, and layout without clearing search", () => {
    const previous: DataTableState = {
      search: "enzymes",
      filters: {},
      sortBy: null,
      sortDirection: "desc",
      groupBy: null,
      page: 4,
      pageSize: 20,
      visibleColumns: ["name"],
      view: "calendar",
    };
    const saved: QuickFilter = {
      id: "saved-1",
      name: "Table",
      target_entity: "tutor:interview_rounds",
      user_id: null,
      created_at: "",
      updated_at: "",
      config: viewConfig({
        filters: { status: ["active"] },
        sortBy: "name",
        sortDirection: "asc",
        groupBy: "day",
        visibleColumns: ["name", "date"],
        layout: "table",
      }),
    };
    expect(applySavedViewToTableState(previous, saved, defaults, actor)).toEqual({
      search: "enzymes",
      filters: { status: ["active"] },
      sortBy: "name",
      sortDirection: "asc",
      groupBy: "day",
      page: 1,
      pageSize: 20,
      visibleColumns: ["name", "date"],
      view: "table",
    });
  });
});
