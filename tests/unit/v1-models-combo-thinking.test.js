import { describe, it, expect, vi } from "vitest";

// The route reads combos/settings from the live DB. Mock the data layer so the
// test is deterministic and does not depend on the machine's combos.
const mocks = vi.hoisted(() => ({
  getCombos: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getCombos: mocks.getCombos,
  getSettings: mocks.getSettings,
  getProviderConnections: vi.fn(async () => []),
  getCustomModels: vi.fn(async () => []),
  getModelAliases: vi.fn(async () => ({})),
}));

vi.mock("@/lib/disabledModelsDb", () => ({
  getDisabledModels: vi.fn(async () => []),
}));

const { buildModelsList } = await import("../../src/app/api/v1/models/route.js");

function comboEntry(name, strategyConfig) {
  return {
    id: crypto.randomUUID(),
    name,
    models: ["anthropic/claude-sonnet-4.5"],
    strategyConfig,
  };
}

describe("v1/models combo thinking exposure", () => {
  it("advertises effective thinking via capabilities on the extremecombos combo", async () => {
    mocks.getCombos.mockResolvedValue([
      comboEntry("extremecombos", { thinking: { type: "effort", roles: { manager: { type: "effort", effort: "high" } } } }),
    ]);
    mocks.getSettings.mockResolvedValue({});

    const list = await buildModelsList(["llm"]);
    const combo = list.find((m) => m.owned_by === "combo" && m.id === "extremecombos");
    expect(combo).toBeDefined();
    expect(combo.capabilities).toEqual({ thinking: true, agentic: false });
  });

  it("applies the settings comboStrategies override when merging", async () => {
    mocks.getCombos.mockResolvedValue([
      comboEntry("extremecombos", { thinking: { type: "auto" } }),
    ]);
    mocks.getSettings.mockResolvedValue({
      comboStrategies: { extremecombos: { thinking: { type: "effort", effort: "max" } } },
    });

    const list = await buildModelsList(["llm"]);
    const combo = list.find((m) => m.owned_by === "combo" && m.id === "extremecombos");
    expect(combo).toBeDefined();
    expect(combo.capabilities).toEqual({ thinking: true, agentic: false });
  });

  it("creates a minimal entry (no thinking capability) for combos without a thinking override", async () => {
    mocks.getCombos.mockResolvedValue([comboEntry("deepseek", {})]);
    mocks.getSettings.mockResolvedValue({});

    const list = await buildModelsList(["llm"]);
    const combo = list.find((m) => m.owned_by === "combo" && m.id === "deepseek");
    expect(combo).toBeDefined();
    expect(combo.capabilities).toBeUndefined();
  });
});
