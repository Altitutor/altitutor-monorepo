import { findFindWordKeywordOccurrences } from "../ucat-skill-trainer";

describe("findFindWordKeywordOccurrences", () => {
  it("accepts a click on a hyphenated passage token only when the keyword is that whole word", () => {
    const passage =
      'They reached #32 in the US in mid-1969.';
    const tokenStart = passage.indexOf("mid-1969");

    expect(
      findFindWordKeywordOccurrences(passage, { id: "kw1", text: "1969" }),
    ).toEqual([]);
    expect(
      findFindWordKeywordOccurrences(passage, { id: "kw1", text: "mid-1969" }),
    ).toEqual([{ keyword_id: "kw1", start: tokenStart, end: tokenStart + "mid-1969".length }]);
  });

  it("does not treat a keyword as found when it is only a prefix or infix of a longer word", () => {
    expect(
      findFindWordKeywordOccurrences("The category of metals includes gold.", {
        id: "kw1",
        text: "cat",
      }),
    ).toEqual([]);
    expect(
      findFindWordKeywordOccurrences("He spent 110 weeks in the top-10.", {
        id: "kw1",
        text: "10",
      }),
    ).toEqual([]);
  });

  it("keeps multi-word date keywords placeable by clicking any of their words", () => {
    const passage = "Alan Turing (23 June 1912 – 7 June 1954) was a mathematician.";
    const start = passage.indexOf("23 June 1912");
    const occurrences = findFindWordKeywordOccurrences(passage, {
      id: "kw1",
      text: "23 June 1912",
    });

    expect(occurrences).toEqual([
      { keyword_id: "kw1", start, end: start + "23 June 1912".length },
    ]);
    expect(passage.indexOf("June")).toBeGreaterThanOrEqual(occurrences[0]!.start);
    expect(passage.indexOf("June")).toBeLessThan(occurrences[0]!.end);
  });

  it("matches a whole word even when earlier letters change length after lowercasing", () => {
    const passage = "İstanbul loans were approved in 2025.";
    const start = passage.indexOf("loans");
    expect(
      findFindWordKeywordOccurrences(passage, { id: "kw1", text: "loans" }),
    ).toEqual([{ keyword_id: "kw1", start, end: start + "loans".length }]);
  });
});
