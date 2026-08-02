import { getModelInfo } from "./model.js";
import { normalizeComboStrategyConfig, estimateLogicalCalls } from "open-sse/services/comboConfig.js";

const allowedByRule = (allowed, model) => allowed.some((rule) => rule === model || (rule.endsWith("/") && model.startsWith(rule)));

export async function buildComboExecutionGraph(combo, legacyConfig = {}) {
  const members = Array.isArray(combo?.models) ? [...combo.models] : [];
  // Strategy resolution order:
  //   1. legacyConfig (settings.comboStrategies[comboName]) — the location the
  //      ComboCard strategy editor writes to. It is the user's live override.
  //   2. combo.strategyConfig — the persisted combo definition. This is ALWAYS
  //      non-empty (create fills in normalized defaults), so it must NOT take
  //      precedence over a settings override — otherwise editing strategy in
  //      the UI appears to "not stick" (dispatch keeps using the stale default).
  const config = normalizeComboStrategyConfig(
    legacyConfig && typeof legacyConfig === "object" && Object.keys(legacyConfig).length
      ? legacyConfig
      : combo?.strategyConfig,
  );
  const first = members[0] || "";
  const roleModels = config.fallbackStrategy === "fusion"
    ? { judge: config.judgeModel || first }
    : config.fallbackStrategy === "swarm"
      ? {
          manager: config.managerModel || first,
          staff: config.staffModel || config.managerModel || first,
          audit: config.auditModel || config.staffModel || config.managerModel || first,
        }
      : {};

  const refs = [...members, ...Object.values(roleModels)].filter(Boolean);
  const resolved = [];
  for (const ref of refs) {
    const info = await getModelInfo(ref);
    if (!info?.provider || !info?.model) throw new Error(`Unresolved combo model: ${ref}`);
    resolved.push({ ref, provider: info.provider, model: info.model, canonical: `${info.provider}/${info.model}` });
  }

  return Object.freeze({
    comboName: combo.name,
    comboId: combo.id,
    members: Object.freeze(members),
    config: Object.freeze(config),
    roleModels: Object.freeze(roleModels),
    leaves: Object.freeze(resolved),
    logicalCalls: estimateLogicalCalls(config, members.length),
  });
}

export function authorizeComboExecution(keyObj, graph) {
  const allowed = keyObj?.allowedModels;
  if (!Array.isArray(allowed) || allowed.length === 0) return { allowed: true, denied: [] };

  const denied = [];
  if (!allowedByRule(allowed, graph.comboName)) denied.push(graph.comboName);
  for (const leaf of graph.leaves) {
    if (!allowedByRule(allowed, leaf.ref) && !allowedByRule(allowed, leaf.canonical)) denied.push(leaf.ref);
  }
  return { allowed: denied.length === 0, denied: [...new Set(denied)] };
}
