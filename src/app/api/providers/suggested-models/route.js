import { NextResponse } from "next/server";
import { getProviderConnectionById } from "@/models";
import { FILTERS } from "./filters.js";

export const dynamic = "force-dynamic";

/**
 * GET /api/providers/suggested-models
 *
 * Query params:
 *   url          — models endpoint URL (required unless connectionId resolves one)
 *   type         — FILTERS key (required)
 *   connectionId — optional. When set, the server loads the connection's apiKey
 *                  and sends Authorization: Bearer <key>. The key never leaves
 *                  the server — clients only pass the connection id.
 *
 * Used by the provider detail page to populate the "suggested models" list for
 * providers that expose a public or key-gated /v1/models catalog
 * (hcnsec, forge, tokenrouter, featherless, venice, …).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let url = searchParams.get("url");
  const type = searchParams.get("type");
  const connectionId = searchParams.get("connectionId");

  if (!type) {
    return NextResponse.json({ error: "Missing type" }, { status: 400 });
  }

  const filter = FILTERS[type];
  if (!filter) {
    return NextResponse.json({ error: "Unknown filter type" }, { status: 400 });
  }

  // Resolve auth from connection when provided. API keys stay server-side —
  // the client never sees or transmits the raw key (connections are sanitized
  // before reaching the browser).
  let authHeader = null;
  if (connectionId) {
    try {
      const connection = await getProviderConnectionById(connectionId);
      if (!connection) {
        return NextResponse.json({ error: "Connection not found" }, { status: 404 });
      }
      const token = connection.apiKey || connection.accessToken;
      if (token) {
        authHeader = `Bearer ${token}`;
      }
    } catch {
      // Fall through — try unauthenticated fetch
    }
  }

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const headers = { Accept: "application/json" };
    if (authHeader) headers.Authorization = authHeader;

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      return NextResponse.json({ data: [] });
    }
    const json = await res.json();
    const raw = json.data ?? json.models ?? json;
    const data = filter(Array.isArray(raw) ? raw : []);
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
