import {
  buildQuestionTagsPrompt,
  buildStationNamePrompt,
  readSelectedTagIds,
  readStationName,
  STATION_NAME_INSTRUCTION,
} from "../station-ai";

const tags = [
  { id: "a11e0002-0000-4000-8000-000000000001", name: "Empathy" },
  { id: "a11e0002-0000-4000-8000-000000000002", name: "Autonomy" },
];

describe("interview station AI prompts", () => {
  it("asks for a concise station name and includes the prompt and questions", () => {
    const prompt = buildStationNamePrompt("A patient is upset.", [
      " What happened? ",
      "",
      "How would you respond?",
    ]);
    expect(prompt.startsWith(STATION_NAME_INSTRUCTION)).toBe(true);
    expect(prompt).toContain("Prompt:\nA patient is upset.");
    expect(prompt).toContain("1. What happened?\n2. How would you respond?");
  });

  it("gives the model the prompt, question, and every tag", () => {
    const prompt = buildQuestionTagsPrompt("Ward context", "What would you do?", tags);
    expect(prompt).toContain("Prompt:\nWard context");
    expect(prompt).toContain("Question:\nWhat would you do?");
    expect(prompt).toContain(`${tags[0].id} Empathy`);
    expect(prompt).toContain(`${tags[1].id} Autonomy`);
  });

  it("keeps a concise station name and shortens a long one on a word boundary", () => {
    expect(readStationName({ name: '  "Missed instructions"  ' })).toBe(
      "Missed instructions",
    );
    const long = "A very long generated station name that keeps going past the concise limit";
    const name = readStationName({ name: long });
    expect(name).toBeTruthy();
    expect(name!.length).toBeLessThanOrEqual(80);
    expect(name!.endsWith(" ")).toBe(false);
  });

  it("keeps only tags the model was offered, matching ids or names", () => {
    expect(
      readSelectedTagIds(
        {
          tagIds: [
            tags[0].id,
            "not-a-tag",
            "autonomy",
            { id: tags[0].id },
          ],
        },
        tags,
      ),
    ).toEqual([tags[0].id, tags[1].id]);
    expect(readSelectedTagIds({ tags: ["Empathy"] }, tags)).toEqual([tags[0].id]);
    expect(readSelectedTagIds({ tagIds: [] }, tags)).toEqual([]);
  });
});
