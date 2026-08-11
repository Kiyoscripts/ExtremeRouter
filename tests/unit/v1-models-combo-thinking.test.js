import { describe, it, expect } from "vitest";
import { buildModelsList } from "../../src/app/api/v1/models/route.js";

describe("v1/models combo thinking exposure", () => {
  it("advertises effective thinking via capabilities on the extremecombos combo", async () => {
    const list = await buildModelsList(["llm"]);
    const combo = list.find((m) => m.owned_by === "combo" && m.id === "extremecombos");
    expect(combo).toBeDefined();
    expect(combo.capabilities).toEqual({ thinking: true, agentic: false });
  });

  it("creates a minimal entry (no thinking capability) for combos without a thinking override", async () => {
    const list = await buildModelsList(["llm"]);
    const combo = list.find((m) => m.owned_by === "combo" && m.id === "deepseek");
    expect(combo).toBeDefined();
    expect(combo.capabilities).toBeUndefined();
  });
});