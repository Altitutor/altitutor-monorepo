import {
  DEFAULT_UCAT_INTERFACE_PREFERENCES,
  parseUcatInterfacePreferences,
  parseUcatInterfacePreferencesPatch,
} from "@/features/interface-preferences/model/types";

describe("UCAT interface preferences", () => {
  it("defaults to the compact top toolbar and safe app defaults", () => {
    expect(parseUcatInterfacePreferences(null)).toEqual(
      DEFAULT_UCAT_INTERFACE_PREFERENCES,
    );
  });

  it("accepts only known, correctly typed preference patches", () => {
    expect(
      parseUcatInterfacePreferencesPatch({
        examToolbarLayout: "detailed_right",
        examToolbarVisible: false,
        nextQuestionPopupEnabled: false,
      }),
    ).toEqual({
      examToolbarLayout: "detailed_right",
      examToolbarVisible: false,
      nextQuestionPopupEnabled: false,
    });
    expect(
      parseUcatInterfacePreferencesPatch({ unknownPreference: true }),
    ).toBeNull();
    expect(
      parseUcatInterfacePreferencesPatch({ examToolbarVisible: "yes" }),
    ).toBeNull();
  });
});
