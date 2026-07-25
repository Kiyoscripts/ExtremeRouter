// Free OpenCode models that don't use the "-free" id suffix
const KNOWN_FREE_OPENCODE_MODELS = ["big-pickle"];

function openaiStyleMap(models) {
  return (Array.isArray(models) ? models : [])
    .map((m) => {
      const id = m?.id || m?.model || m?.name;
      if (!id || typeof id !== "string") return null;
      // Skip embedding-only entries when the catalog tags them
      const kind = m?.object || m?.type || m?.capabilities?.type;
      if (kind === "embedding" || /embed/i.test(id)) return null;
      return {
        id,
        name: m?.name || m?.display_name || m?.displayName || id,
        contextLength: m?.context_length || m?.contextLength || m?.max_model_len || undefined,
      };
    })
    .filter(Boolean);
}

export const FILTERS = {
  // Standard OpenAI /v1/models shape — used by hcnsec, forge, tokenrouter,
  // featherless, venice, vercel-ai-gateway, etc.
  openai: openaiStyleMap,

  // AgentRouter — /api/pricing returns { data: [{ model_name, ... }] }
  agentrouter: (data) => {
    const models = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    return models
      .map((m) => ({
        id: m.model_name || m.id || m.name,
        name: m.model_name || m.id || m.name,
      }))
      .filter((m) => m.id);
  },

  // InxoraStudio Labs — /api/ai/models returns { models: [...], plan: "..." }
  // with per-model accessibility + chat flags. Keep only accessible chat models.
  inxora: (data) => {
    const models = Array.isArray(data?.models) ? data.models : (Array.isArray(data) ? data : []);
    return models
      .filter((m) => m?.accessible !== false && m?.chat !== false)
      .map((m) => ({
        id: m.id || m.name,
        name: m.displayName || m.name || m.id,
      }))
      .filter((m) => m.id);
  },

  "openrouter-free": (models) =>
    models
      .filter(
        (m) =>
          m.pricing?.prompt === "0" &&
          m.pricing?.completion === "0" &&
          m.context_length >= 200000
      )
      .map((m) => ({ id: m.id, name: m.name, contextLength: m.context_length }))
      .sort((a, b) => b.contextLength - a.contextLength),

  "opencode-free": (models) =>
    models
      .filter((m) => m.id?.endsWith("-free") || KNOWN_FREE_OPENCODE_MODELS.includes(m.id))
      .map((m) => ({ id: m.id, name: m.id })),

  // models.dev returns a large catalog; keep only mimo models
  "mimo-free": (models) =>
    (Array.isArray(models) ? models : [])
      .filter((m) => m.id?.startsWith("mimo") || m.name?.toLowerCase().includes("mimo"))
      .map((m) => ({ id: m.id, name: m.name || m.id })),
};
