const STRATEGIES = new Set(["fallback", "round-robin", "fusion", "swarm", "cascade"]);
const KINDS = new Set(["llm", "image", "tts", "stt", "embedding", "imageToText", "webSearch", "webFetch"]);

export const COMBO_LIMITS = Object.freeze({
      maxMembers: 999,
  maxWorkers: 8,
  maxConcurrentRunsPerPrincipal: 2,
  maxConcurrentRunsGlobal: 8,
  maxProviderFanout: 4,
  minTimeoutMs: 1000,
  maxTimeoutMs: 120000,
  maxGraceMs: 30000,
  maxOutputChars: 120000,
  maxAggregateOutputChars: 300000,
  maxLogicalCalls: 16,
  maxEstimatedCostUsd: 100,
});

const MODEL_REF_RE = /^[a-zA-Z0-9_.-]+\/.+$/;
const asInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
const asNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export function normalizeStrategy(value) {
  const strategy = typeof value === "string" ? value.trim().toLowerCase() : "fallback";
  return STRATEGIES.has(strategy) ? strategy : "fallback";
}

// Normalize cascade-specific config. Cascade tries models in order, escalating
// to the next stage only when the current model's self-reported confidence is
// below the threshold. The final stage always returns its answer regardless.
function normalizeCascadeConfig(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    confidenceThreshold: asInt(source.confidenceThreshold, 70, 0, 100),
    confidencePrompt: typeof source.confidencePrompt === "string" && source.confidencePrompt.trim()
      ? source.confidencePrompt.trim()
      : "Rate your confidence in this answer from 0 to 100. End your response with exactly: CONFIDENCE: <number>",
    escalatePrompt: typeof source.escalatePrompt === "string" && source.escalatePrompt.trim()
      ? source.escalatePrompt.trim()
      : "A prior model gave the following answer with low confidence. Review it, correct any issues, and provide a better answer.",
    maxStages: asInt(source.maxStages, 3, 1, 8),
  };
}

const THINKING_TYPES = new Set(["auto", "off", "extended", "effort"]);
const THINKING_EFFORTS = new Set(["low", "medium", "high", "max"]);

// Normalize a combo-level thinking config (and optional per-role overrides).
// Returns { type: "auto" } (which the runtime treats as "no override") when
// the input is missing/invalid so the rest of the pipeline always gets a well
// formed object to read.
function normalizeThinking(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const type = THINKING_TYPES.has(source.type) ? source.type : "auto";
  const out = { type };
  if (type === "effort") {
    const effort = typeof source.effort === "string" && THINKING_EFFORTS.has(source.effort) ? source.effort : "high";
    out.effort = effort;
  }
  if (type === "extended") {
    out.budgetTokens = asInt(source.budgetTokens, 4096, 1024, 128000);
  }
  if (source.roles && typeof source.roles === "object" && !Array.isArray(source.roles)) {
    out.roles = {};
    for (const [role, cfgRaw] of Object.entries(source.roles)) {
      if (!cfgRaw || typeof cfgRaw !== "object") continue;
      const rType = THINKING_TYPES.has(cfgRaw.type) ? cfgRaw.type : "inherit";
      if (rType === "inherit") {
        out.roles[role] = { type: "inherit", ...(cfgRaw.effort ? { effort: cfgRaw.effort } : {}), ...(cfgRaw.budgetTokens ? { budgetTokens: cfgRaw.budgetTokens } : {}) };
      } else if (rType === "off" || rType === "auto") {
        out.roles[role] = { type: rType };
      } else if (rType === "effort") {
        out.roles[role] = { type: "effort", effort: THINKING_EFFORTS.has(cfgRaw.effort) ? cfgRaw.effort : "high" };
      } else if (rType === "extended") {
        out.roles[role] = { type: "extended", budgetTokens: asInt(cfgRaw.budgetTokens, 4096, 1024, 128000) };
      }
    }
  }
  return out;
}

export function normalizeComboStrategyConfig(raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const fallbackStrategy = normalizeStrategy(source.fallbackStrategy);
  const workerCount = asInt(source.workerCount, 4, 1, COMBO_LIMITS.maxWorkers);
  const swarmSource = source.swarmTuning && typeof source.swarmTuning === "object" ? source.swarmTuning : {};
  const fusionSource = source.fusionTuning && typeof source.fusionTuning === "object" ? source.fusionTuning : {};
  const budgetsSource = source.budgets && typeof source.budgets === "object" ? source.budgets : {};
  const cascadeSource = source.cascade && typeof source.cascade === "object" ? source.cascade : {};

  return {
    fallbackStrategy,
    judgeModel: typeof source.judgeModel === "string" ? source.judgeModel.trim() : "",
    managerModel: typeof source.managerModel === "string" ? source.managerModel.trim() : "",
    staffModel: typeof source.staffModel === "string" ? source.staffModel.trim() : "",
    auditModel: typeof source.auditModel === "string" ? source.auditModel.trim() : "",
    workerCount,
    enableTelemetry: source.enableTelemetry !== false,
    thinking: normalizeThinking(source.thinking),
    cascade: normalizeCascadeConfig(cascadeSource),
    fusionTuning: {
      minPanel: asInt(fusionSource.minPanel, 2, 2, COMBO_LIMITS.maxMembers),
      stragglerGraceMs: asInt(fusionSource.stragglerGraceMs, 8000, 0, COMBO_LIMITS.maxGraceMs),
      panelHardTimeoutMs: asInt(fusionSource.panelHardTimeoutMs, 90000, COMBO_LIMITS.minTimeoutMs, COMBO_LIMITS.maxTimeoutMs),
    },
    swarmTuning: {
      workerHardTimeoutMs: asInt(swarmSource.workerHardTimeoutMs, 90000, COMBO_LIMITS.minTimeoutMs, COMBO_LIMITS.maxTimeoutMs),
      workerQuorum: asInt(swarmSource.workerQuorum, Math.min(2, workerCount), 1, workerCount),
      stragglerGraceMs: asInt(swarmSource.stragglerGraceMs, 10000, 0, COMBO_LIMITS.maxGraceMs),
      managerTimeoutMs: asInt(swarmSource.managerTimeoutMs, 60000, COMBO_LIMITS.minTimeoutMs, COMBO_LIMITS.maxTimeoutMs),
      minWorkers: asInt(swarmSource.minWorkers, Math.min(2, workerCount), 1, workerCount),
      maxWorkers: asInt(swarmSource.maxWorkers, workerCount, 1, COMBO_LIMITS.maxWorkers),
    },
    budgets: {
      maxLogicalCalls: asInt(budgetsSource.maxLogicalCalls, COMBO_LIMITS.maxLogicalCalls, 1, COMBO_LIMITS.maxLogicalCalls),
      maxOutputChars: asInt(budgetsSource.maxOutputChars, COMBO_LIMITS.maxOutputChars, 1000, COMBO_LIMITS.maxOutputChars),
      maxAggregateOutputChars: asInt(budgetsSource.maxAggregateOutputChars, COMBO_LIMITS.maxAggregateOutputChars, 5000, COMBO_LIMITS.maxAggregateOutputChars),
      maxEstimatedCostUsd: asNumber(budgetsSource.maxEstimatedCostUsd, COMBO_LIMITS.maxEstimatedCostUsd, 0.01, COMBO_LIMITS.maxEstimatedCostUsd),
    },
    autoScale: {
      enabled: source.autoScale?.enabled === true,
      minWorkers: asInt(source.autoScale?.minWorkers, 1, 1, source.autoScale?.maxWorkers || COMBO_LIMITS.maxWorkers),
      maxWorkers: asInt(source.autoScale?.maxWorkers, workerCount || COMBO_LIMITS.maxWorkers, 1, COMBO_LIMITS.maxWorkers),
    },
  };
}

export function validateComboDefinition(data, { allowPartial = false } = {}) {
  const errors = [];
  if (!allowPartial || data.name !== undefined) {
    if (typeof data.name !== "string" || !data.name.trim()) errors.push("Name is required");
    else if (!/^[a-zA-Z0-9_.-]+$/.test(data.name)) errors.push("Name can only contain letters, numbers, -, _ and .");
  }
  if (!allowPartial || data.models !== undefined) {
    if (!Array.isArray(data.models)) errors.push("Models must be an array");
    else {
      const normalized = data.models.map((m) => typeof m === "string" ? m.trim() : "");
	      if (normalized.length < 1) errors.push("At least one model is required");
	      if (normalized.some((m) => !MODEL_REF_RE.test(m))) errors.push("Every model must use provider/model format");
	      if (new Set(normalized).size !== normalized.length) errors.push("Duplicate models are not allowed");
    }
  }
  if (data.kind !== undefined && data.kind !== null && !KINDS.has(data.kind)) errors.push("Invalid combo kind");
  if (data.strategyConfig !== undefined) {
    const raw = data.strategyConfig;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) errors.push("strategyConfig must be an object");
    else {
      for (const field of ["judgeModel", "managerModel", "staffModel", "auditModel"]) {
        if (raw[field] && !MODEL_REF_RE.test(String(raw[field]).trim())) errors.push(`${field} must use provider/model format`);
      }
      const numericContainers = [raw.fusionTuning, raw.swarmTuning, raw.budgets].filter(Boolean);
      if (numericContainers.some((obj) => typeof obj !== "object" || Array.isArray(obj))) errors.push("Tuning and budgets must be objects");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function estimateLogicalCalls(strategyConfig, memberCount) {
  const cfg = normalizeComboStrategyConfig(strategyConfig);
  if (cfg.fallbackStrategy === "fusion") return Math.min(memberCount, COMBO_LIMITS.maxMembers) + 1;
  if (cfg.fallbackStrategy === "swarm") return Math.min(cfg.workerCount, COMBO_LIMITS.maxWorkers) + 4;
  if (cfg.fallbackStrategy === "cascade") return Math.min(memberCount, cfg.cascade?.maxStages || 3);
  return Math.max(1, Math.min(memberCount, COMBO_LIMITS.maxMembers));
}
