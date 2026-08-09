// Server-side thinking-level advertisement for the dashboard picker.
//
// Returns the valid thinking levels for a model, or null when the model has no
// reasoning capability. This is the single source of truth that the dashboard
// uses to decide which levels to show in the per-model thinking picker
// (replacing the previous client-side caps.reasoning gating which was too
// broad for Kiro — it advertised native levels for legacy/unsupported models).
//
// Port of decolua/9router commit 2446f32 (normalize dashboard thinking
// intensity models). Mirrors the KIRO_NATIVE_EFFORT_PREFIXES logic but lives
// here next to capabilities.js so the dashboard can call it without importing
// Kiro internals.

import { getCapabilitiesForModel } from "./capabilities.js";
import { matchPattern } from "./pricing.js";
import { resolveKiroEffortPath } from "../config/kiroConstants.js";

// Shared level sets (deduped) — verified against provider docs + wire in
// thinkingUnified.applyFormat.
const L = {
  // Claude 5 / GPT-5.6 on Kiro accept the full discrete-level range.
  KIRO_NATIVE: ["low", "medium", "high", "xhigh", "max"],
  // Most OpenAI-style providers (OpenAI, DeepSeek, GLM, etc.).
  EFFORT: ["minimal", "low", "medium", "high"],
  // Models that explicitly support "max" (kimi-k3, gpt-5.6-sol on Kiro).
  EFFORT_MAX: ["minimal", "low", "medium", "high", "max"],
};

// Pattern → levels mapping. Order matters: first match wins (specific →
// generic). Patterns use the same glob syntax as capabilities.js.
const PATTERN_THINKING = [
  // Kiro GPT-5.6 family supports xhigh + max.
  { pattern: "gpt-5.6-*", levels: L.KIRO_NATIVE },
  // Kiro Claude 5 family.
  { pattern: "claude-opus-5*", levels: L.KIRO_NATIVE },
  { pattern: "claude-sonnet-5*", levels: L.KIRO_NATIVE },
  { pattern: "claude-haiku-5*", levels: L.KIRO_NATIVE },
];

/**
 * Get the valid thinking levels for a model, or null when the model has no
 * reasoning capability.
 *
 * Kiro special-case: legacy Claude (4.x) and non-Claude/GPT families (GLM,
 * DeepSeek, Qwen, MiniMax) return null — they reason only via the
 * `<thinking_mode>` system tag and reject native effort fields. The dashboard
 * hides the picker entirely for these models so users can't generate an invalid
 * `(level)` suffix.
 *
 * @param {string} provider - provider id (e.g. "kiro", "openai")
 * @param {string} model - model id (without provider prefix)
 * @returns {string[]|null}
 */
export function getThinkingLevels(provider, model) {
  // Kiro gate FIRST: only Claude 5 / GPT-5.6 families advertise native levels.
  // resolveKiroEffortPath returns null for everything else → hide the picker.
  if (provider === "kiro" && resolveKiroEffortPath(model) === null) return null;

  const caps = getCapabilitiesForModel(provider, model);
  if (!caps.reasoning) return null;

  // Pattern match for Kiro native families.
  const hit = PATTERN_THINKING.find((p) => matchPattern(p.pattern, model));
  if (hit) return hit.levels;

  // Explicit per-model level list (caps.thinkingLevels) wins — e.g. kimi-k3
  // ["low","high","max"], laguna-s-2.1 / step-3.7 ["low","medium","high"].
  if (Array.isArray(caps.thinkingLevels)) return caps.thinkingLevels;

  // Generic fallback for non-Kiro reasoning models.
  if (caps.thinkingMaxEffort) return L.EFFORT_MAX;
  return L.EFFORT;
}
