import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const questionsApiSource = readFileSync(
  resolve(process.cwd(), "src/features/ucat/questions/api/questions.ts"),
  "utf8",
);
const reconciliationRouteSource = readFileSync(
  resolve(process.cwd(), "src/app/api/ucat/reconciliation/route.ts"),
  "utf8",
);

describe("UCAT whole-catalog query performance boundary", () => {
  it("uses the compact picker RPC instead of loading every full stem detail", () => {
    const getStemCatalogSource = questionsApiSource.slice(
      questionsApiSource.indexOf("async getStemCatalog"),
      questionsApiSource.indexOf(
        "async create(",
        questionsApiSource.indexOf("async getStemCatalog"),
      ),
    );

    expect(getStemCatalogSource).toContain(
      "tutor_ucat_list_stem_picker_catalog",
    );
    expect(getStemCatalogSource).not.toContain(
      "vtutor_ucat_question_stem_detail",
    );
    expect(getStemCatalogSource).not.toContain("vtutor_ucat_question_stems");
  });

  it("uses a purpose-built reconciliation RPC instead of loading every full stem detail", () => {
    expect(reconciliationRouteSource).toContain(
      "tutor_ucat_reconciliation_content_issues",
    );
    expect(reconciliationRouteSource).not.toContain(
      "vtutor_ucat_question_stem_detail",
    );
  });
});
