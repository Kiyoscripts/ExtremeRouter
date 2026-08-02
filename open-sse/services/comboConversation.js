import { FORMATS } from "../translator/formats.js";
import { extractTextContent } from "../translator/formats/gemini.js";

const textFromParts = (parts) => Array.isArray(parts)
  ? parts.map((p) => typeof p === "string" ? p : p?.text || "").join("")
  : typeof parts === "string" ? parts : "";

export function inferConversationFormat(body) {
  if (body?.request?.contents) return FORMATS.ANTIGRAVITY;
  if (Array.isArray(body?.contents)) return FORMATS.GEMINI;
  if (body?.input !== undefined && !body?.messages) return FORMATS.OPENAI_RESPONSES;
  if (body?.anthropic_version || body?.system !== undefined) return FORMATS.CLAUDE;
  return FORMATS.OPENAI;
}

export function extractLatestUserText(body, format = inferConversationFormat(body)) {
  if (format === FORMATS.OPENAI_RESPONSES && typeof body?.input === "string") return body.input;
  const array = format === FORMATS.ANTIGRAVITY ? body?.request?.contents
    : format === FORMATS.GEMINI ? body?.contents
      : format === FORMATS.OPENAI_RESPONSES ? body?.input
        : body?.messages;
  if (!Array.isArray(array)) return "";
  for (let i = array.length - 1; i >= 0; i--) {
    const item = array[i];
    if (item?.role === "user") return textFromParts(item.content ?? item.parts);
  }
  return "";
}

export function appendDirective(body, text, format = inferConversationFormat(body)) {
  const next = { ...body };
  if (format === FORMATS.ANTIGRAVITY) {
    const request = { ...(body.request || {}) };
    request.contents = [...(request.contents || []), { role: "user", parts: [{ text }] }];
    next.request = request;
  } else if (format === FORMATS.GEMINI) {
    next.contents = [...(body.contents || []), { role: "user", parts: [{ text }] }];
  } else if (format === FORMATS.OPENAI_RESPONSES) {
    const input = typeof body.input === "string" ? [{ role: "user", content: body.input }] : [...(body.input || [])];
    next.input = [...input, { role: "user", content: [{ type: "input_text", text }] }];
  } else {
    next.messages = [...(body.messages || []), { role: "user", content: text }];
  }
  return next;
}

function flattenMessages(messages) {
  return (messages || []).filter(Boolean).map((msg) => {
    if (msg.role === "tool" || msg.role === "function") return { role: "assistant", content: `[Tool result: ${extractTextContent(msg.content) || String(msg.content ?? "")}]` };
    if (msg.role === "assistant" && Array.isArray(msg.tool_calls)) {
      const { tool_calls, ...rest } = msg;
      const names = tool_calls.map((c) => c?.function?.name || c?.name || "tool").join(", ");
      const base = extractTextContent(rest.content) || "";
      return { ...rest, content: `${base}${base ? "\n" : ""}[Called tools: ${names}]` };
    }
    if (Array.isArray(msg.content) && msg.content.some((c) => c?.type === "tool_use" || c?.type === "tool_result")) {
      const text = msg.content.map((c) => c?.text || (c?.type === "tool_use" ? `[Called tool: ${c.name || "tool"}]` : c?.type === "tool_result" ? `[Tool result: ${extractTextContent(c.content)}]` : "")).filter(Boolean).join("\n");
      return { ...msg, content: text };
    }
    return msg;
  });
}

export function buildCoordinatorBody(body, format = inferConversationFormat(body)) {
  const { tools, tool_choice, ...rest } = body;
  const next = { ...rest, stream: false };
  if (format === FORMATS.OPENAI_RESPONSES) {
    if (Array.isArray(next.input)) next.input = flattenMessages(next.input);
  } else if (format === FORMATS.ANTIGRAVITY) {
    next.request = { ...(next.request || {}), tools: undefined };
  } else if (Array.isArray(next.messages)) {
    next.messages = flattenMessages(next.messages);
  }
  return next;
}

export function clampText(text, maxChars) {
  const value = String(text || "");
  return value.length <= maxChars ? value : `${value.slice(0, maxChars)}\n[truncated by combo budget]`;
}
