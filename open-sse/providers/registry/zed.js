// Zed Hosted AI — cloud.zed.dev OAuth provider.
//
// Zed Editor users import their cloud credentials (user_id + access_token),
// which the gateway exchanges for a short-lived LLM bearer token (1h lifetime)
// via POST /client/llm_tokens. The executor auto-refreshes when it expires.
//
// Chat flow: POST /completions with a CompletionBody envelope:
//   { thread_id, prompt_id, provider, model, provider_request }
// where `provider` is one of "anthropic" | "google" | "open_ai" | "x_ai" and
// `provider_request` is the native request body for that upstream. Zed streams
// back JSONL lines of { Status: ... } / { Event: ... } wrapping the upstream
// provider's delta events. The ZedExecutor translates these to OpenAI SSE.
//
// Model routing (resolveZedProvider in openai-to-zed.js):
//   claude*/anthropic* → anthropic | gemini*/google* → google
//   grok*/x-ai*        → x_ai       | everything else → open_ai (Responses API)

export default {
  id: "zed",
  priority: 56,
  alias: "zed",
  uiAlias: "zed",
  display: {
    name: "Zed Hosted AI",
    icon: "code",
    color: "#1348DC",
    textIcon: "Z",
    website: "https://zed.dev",
    notice: {
      signupUrl: "https://zed.dev",
      text: "Zed Hosted AI provides access to Claude, GPT, and Gemini models via the Zed Editor cloud. Import your Zed credentials (user ID + access token from the Zed keychain) to mint an LLM token automatically.",
    },
  },
  category: "oauth",
  transport: {
    baseUrl: "https://cloud.zed.dev",
    chatPath: "/completions",
    format: "zed",
    headers: {
      "Content-Type": "application/json",
      "x-zed-client-supports-status-messages": "true",
      "x-zed-client-supports-x-ai": "true",
    },
  },
  // Catalog from GET /models (Bearer llm_token). Plan gating still applies at /completions.
  models: [
    { id: "claude-sonnet-5", name: "Claude Sonnet 5" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    { id: "gpt-5.6-sol", name: "GPT-5.6 Sol" },
    { id: "gpt-5.6-terra", name: "GPT-5.6 Terra" },
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna" },
    { id: "gpt-5.5", name: "GPT-5.5" },
    { id: "gpt-5.4", name: "GPT-5.4" },
    { id: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
    { id: "gpt-5.2", name: "GPT-5.2" },
    { id: "gpt-5.2-codex", name: "GPT-5.2 Codex" },
    { id: "gpt-5-mini", name: "GPT-5 mini" },
    { id: "gpt-5-nano", name: "GPT-5 nano" },
    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro" },
    { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
    { id: "gemini-3-flash", name: "Gemini 3 Flash" },
  ],
  oauth: {
    apiEndpoint: "https://cloud.zed.dev",
    completionsPath: "/completions",
    modelsPath: "/models",
    llmTokensPath: "/client/llm_tokens",
    usersMePath: "/client/users/me",
    // LLM tokens are short-lived (1h). Refresh 5 minutes before expiry.
    refreshLeadMs: 300000,
  },
};
