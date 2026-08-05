export default {
  id: "cline",
  priority: 80,
  alias: "cl",
  uiAlias: "cl",
  display: {
    name: "Cline",
    icon: "smart_toy",
    color: "#5B9BD5",
    textIcon: "CL",
    website: "https://cline.bot",
    notice: {
      signupUrl: "https://cline.bot",
      apiKeyUrl: "https://app.cline.bot/settings#api-keys",
    },
  },
  category: "oauth",
  authModes: ["oauth", "apikey"],
  hasOAuth: true,
  transport: {
    baseUrl: "https://api.cline.bot/api/v1/chat/completions",
    headers: {
      "HTTP-Referer": "https://cline.bot",
      "X-Title": "Cline",
    },
    tokenUrl: "https://api.cline.bot/api/v1/auth/token",
    refreshUrl: "https://api.cline.bot/api/v1/auth/refresh",
    auth: {
      combined: true,
      header: "Authorization",
      scheme: "bearer",
      hooks: [
        "clineHeaders",
      ],
    },
    // Quota Tracker — plan usage limits (5h / weekly / monthly) returned as
    // percentUsed. No absolute token/request counts are exposed.
    usage: {
      url: "https://api.cline.bot/api/v1/users/me/plan/usage-limits",
    },
  },
  // Model IDs use the `{vendor}/{model}` format (OpenRouter convention), where the
  // suffix is each vendor's NATIVE id verbatim. Source: https://docs.cline.bot/api/models
  //
  // Anthropic ids therefore use DASHES for the version (`claude-sonnet-4-6`), matching
  // Anthropic's own API — not dots. Sending `claude-sonnet-4.6` is rejected upstream.
  // OpenAI/Google/MiniMax keep their native dots (`gpt-4o`, `gemini-2.5-pro`,
  // `minimax-m2.5`). Do not "normalize" one family to the other.
  models: [
    { id: "anthropic/claude-opus-4-7", name: "Claude Opus 4.7" },
    { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "anthropic/claude-opus-4-6", name: "Claude Opus 4.6" },
    { id: "anthropic/claude-3-7-sonnet", name: "Claude 3.7 Sonnet" },
    { id: "openai/gpt-5.3-codex", name: "GPT-5.3 Codex" },
    { id: "openai/gpt-5.4", name: "GPT-5.4" },
    { id: "openai/gpt-4o", name: "GPT-4o" },
    { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
    { id: "google/gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite Preview" },
    { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "deepseek/deepseek-chat", name: "DeepSeek Chat" },
    // Cline's documented "free experimentation" slot. Reachable on OAuth
    // connections (same token class as the IDE/CLI); plain API keys are
    // documented as excluded from free-tier models.
    { id: "minimax/minimax-m2.5", name: "MiniMax M2.5 (Free)" },
    { id: "kwaipilot/kat-coder-pro", name: "KAT Coder Pro" },
  ],
  // Cline rotates its free/promo lineup and exposes no public model-catalog
  // endpoint (`/api/v1/models` is auth-gated), so the list above can never be
  // exhaustive. Passthrough lets users reach newly added ids without a registry
  // edit + release.
  passthroughModels: true,
  oauth: {
    appBaseUrl: "https://app.cline.bot",
    apiBaseUrl: "https://api.cline.bot",
    authorizeUrl: "https://api.cline.bot/api/v1/auth/authorize",
    tokenUrl: "https://api.cline.bot/api/v1/auth/token",
    refreshUrl: "https://api.cline.bot/api/v1/auth/refresh",
  },
  thinkingConfig: {
    options: ["auto", "on", "off"],
    defaultMode: "auto",
  },
  features: {
    usage: true,
    usageApikey: true,
  },
};
