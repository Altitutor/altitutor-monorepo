import { test } from "node:test";
import assert from "node:assert/strict";
import { UCAT_SKILL_TRAINER_KEYS } from "@altitutor/shared";
import {
  DEMO_STEPS,
  latestDemoTyped,
  type DemoStep,
} from "../features/skill-trainer/lib/demo-script";

test("every skill trainer has a how-to-play script", () => {
  for (const key of UCAT_SKILL_TRAINER_KEYS) {
    assert.ok(DEMO_STEPS[key].length > 0, key);
    assert.ok(
      DEMO_STEPS[key].every((step) => step.caption.length > 0),
      key,
    );
  }
});

test("latestDemoTyped returns the newest matching typed value", () => {
  const steps: DemoStep[] = [
    { caption: "type", typed: "1", activeKey: "1" },
    { caption: "type", typed: "12", activeKey: "2" },
    { caption: "submit" },
  ];
  assert.equal(
    latestDemoTyped(steps, 2, (step) => Boolean(step.activeKey)),
    "12",
  );
  assert.equal(
    latestDemoTyped(steps, 0, (step) => Boolean(step.activeKey)),
    "1",
  );
  assert.equal(
    latestDemoTyped(steps, 2, (step) => step.target === "missing"),
    "",
  );
});
