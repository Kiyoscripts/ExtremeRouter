// Verify strategy resolution priority: settings.comboStrategies[comboName]
// (UI override) must WIN over combo.strategyConfig (persisted default).
// This was the root cause of "combo set to Fusion but runs as fallback".
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./model.js", () => ({
  getModelInfo: vi.fn(async (ref) => {
    const [provider, model] = ref.split("/");
    return { provider, model };
  }),
}));

import { buildComboExecutionGraph } from "@/sse/services/comboExecutionPolicy.js";

const comboWithDefault = {
  name: "glm-free",
  id: "c1",
  models: ["oc/deepseek-v4-flash-free", "kimchi/deepseek-v4-flash"],
  // combosRepo always fills strategyConfig with normalized defaults → non-empty
  strategyConfig: { fallbackStrategy: "fallback", thinking: { type: "auto" } },
};

describe("combo strategy resolution priority", () => {
  it("settings override (fusion) wins over combo.strategyConfig (fallback)", async () => {
    const settingsEntry = { fallbackStrategy: "fusion", judgeModel: "oc/deepseek-v4-flash-free" };
    const graph = await buildComboExecutionGraph(comboWithDefault, settingsEntry);
    expect(graph.config.fallbackStrategy).toBe("fusion");
  });

  it("combo.strategyConfig used when no settings entry exists", async () => {
    const graph = await buildComboExecutionGraph(comboWithDefault, undefined);
    expect(graph.config.fallbackStrategy).toBe("fallback");
  });

  it("empty settings entry object falls back to combo.strategyConfig", async () => {
    const graph = await buildComboExecutionGraph(comboWithDefault, {});
    expect(graph.config.fallbackStrategy).toBe("fallback");
  });
});
