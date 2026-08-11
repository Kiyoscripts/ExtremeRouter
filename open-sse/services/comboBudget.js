import { COMBO_LIMITS, normalizeComboStrategyConfig } from "./comboConfig.js";
import { getCapabilitiesForModel } from "../providers/capabilities.js";
import { getPricingForModel } from "../providers/pricing.js";

const estimateChars = (value) => {
  try { return JSON.stringify(value).length; } catch { return 0; }
};
export const estimateTokens = (value) => Math.ceil(estimateChars(value) / 4);

export function createComboBudget({ body, config, leaves = [], logicalCalls = 1 }) {
  const normalized = normalizeComboStrategyConfig(config);
  const limits = normalized.budgets;
  const inputTokens = estimateTokens(body);
  let estimatedCostUsd = 0;
  for (const leaf of leaves) {
    const pricing = getPricingForModel(leaf.provider, leaf.model);
    if (!pricing) continue;
    const caps = getCapabilitiesForModel(leaf.provider, leaf.model);
    const output = Math.min(caps.maxOutput || 4000, 4000);
    estimatedCostUsd += inputTokens * (pricing.input / 1_000_000) + output * (pricing.output / 1_000_000);
  }
  if (logicalCalls > limits.maxLogicalCalls) return { ok: false, code: "combo_call_budget_exceeded", logicalCalls, limit: limits.maxLogicalCalls };
  if (limits.enabled && estimatedCostUsd > limits.maxEstimatedCostUsd) return { ok: false, code: "combo_cost_budget_exceeded", estimatedCostUsd, limit: limits.maxEstimatedCostUsd };

  let aggregateOutputChars = 0;
  return {
    ok: true,
    inputTokens,
    estimatedCostUsd,
    limits,
    consumeOutput(text) {
      const chars = String(text || "").length;
      aggregateOutputChars += chars;
      return chars <= limits.maxOutputChars && aggregateOutputChars <= limits.maxAggregateOutputChars;
    },
    clampOutput(text) {
      const remaining = Math.max(0, Math.min(limits.maxOutputChars, limits.maxAggregateOutputChars - aggregateOutputChars));
      const value = String(text || "");
      // slice to `remaining` directly; `remaining || maxOutputChars` would
      // bypass the aggregate cap when remaining is 0 (0 || fallback = fallback),
      // letting later outputs exceed maxAggregateOutputChars. At 0 the output
      // is dropped — callers (fusion/swarm) treat "" as over-budget.
      const out = value.slice(0, remaining);
      aggregateOutputChars += out.length;
      return out;
    },
    snapshot() { return { inputTokens, estimatedCostUsd, aggregateOutputChars, limits }; },
  };
}
