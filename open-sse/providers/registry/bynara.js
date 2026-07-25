// Bynara — multi-model AI router (router.bynara.id).
//
// OpenAI-compatible + Anthropic-native + Responses API gateway behind a single
// API key. Supports LLM chat, image generation, and image editing. Models
// discovered live via /v1/models at runtime.
//
// Multi-endpoint transport with cross-transport fallback: if the OpenAI
// endpoint times out or 5xxs, the engine retries via the Anthropic endpoint
// automatically (body is re-translated to Claude format).
//
// Image generation uses a separate host (api-images.bynara.id).
import { CLAUDE_API_HEADERS } from "../shared.js";

export default {
  id: "bynara",
  priority: 350,
  alias: "bynara",
  aliases: ["by"],
  uiAlias: "by",
  display: {
    name: "Bynara",
    icon: "hub",
    color: "#6366F1",
    textIcon: "BY",
    website: "https://router.bynara.id",
    notice: {
      signupUrl: "https://router.bynara.id/register?ref=884C9YJM",
      apiKeyUrl: "https://router.bynara.id/register?ref=884C9YJM",
      text: "Bynara is a multi-model AI router with OpenAI, Anthropic, and Responses API support. Create an API key at router.bynara.id, then paste it here. Supports LLM chat, image generation, and image editing.",
    },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  transport: {
    // Default = OpenAI format (most clients use this).
    baseUrl: "https://router.bynara.id/v1/chat/completions",
    format: "openai",
    responsesUrl: "https://router.bynara.id/v1/responses",
    validateUrl: "https://router.bynara.id/v1/models",
    auth: {
      combined: true,
      header: "Authorization",
      scheme: "bearer",
    },
  },
  // Multi-endpoint: both OpenAI and Anthropic formats supported. The engine
  // picks the endpoint matching the client sourceFormat (skip translation),
  // and falls back to the alternate on timeout/5xx (cross-transport fallback).
  transports: [
    {
      format: "openai",
      baseUrl: "https://router.bynara.id/v1/chat/completions",
      responsesUrl: "https://router.bynara.id/v1/responses",
      auth: { combined: true, header: "Authorization", scheme: "bearer" },
    },
    {
      format: "claude",
      baseUrl: "https://router.bynara.id/v1/messages",
      headers: { ...CLAUDE_API_HEADERS },
      auth: { combined: true, header: "x-api-key", scheme: "raw" },
    },
  ],
  // Live discovery — /v1/models exposes whatever the key has access to.
  models: [],
  passthroughModels: true,
  modelsFetcher: {
    url: "https://router.bynara.id/v1/models",
    type: "openai",
  },
  // Image generation via separate host.
  serviceKinds: ["llm", "image"],
  imageConfig: {
    baseUrl: "https://api-images.bynara.id/v1/images/generations",
    editUrl: "https://api-images.bynara.id/v1/images/edits",
    bodyFields: ["model", "prompt", "n", "size", "response_format"],
  },
};
