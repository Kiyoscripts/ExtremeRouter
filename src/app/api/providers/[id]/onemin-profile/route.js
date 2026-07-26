import { NextResponse } from "next/server";
import { getProviderConnectionById } from "@/lib/localDb";

// GET /api/providers/[id]/onemin-profile
//
// Fetches the 1min.ai credit balance by calling /teams/{teamId}/credits.
// The teamId is extracted from the JWT payload. Used to display profile
// info in the provider detail page.
export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const connection = await getProviderConnectionById(id);
    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    let token = (connection.apiKey || "").replace(/^Bearer\s+/i, "").replace(/^cookie:\s*/i, "").trim();

    // Extract teamId from JWT.
    const parts = token.split(".");
    let teamId = null;
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
        teamId = payload?.uuid;
      } catch {}
    }

    if (!teamId) {
      return NextResponse.json({ error: "Could not extract team ID from token" }, { status: 400 });
    }

    const res = await fetch(`https://api.1min.ai/teams/${teamId}/credits`, {
      method: "GET",
      headers: {
        "x-auth-token": `Bearer ${token}`,
        "x-app-version": "1.2.3",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    if (!res.ok) {
      return NextResponse.json({ error: `1min.ai returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();

    return NextResponse.json({
      name: "1min.ai",
      email: "",
      plan: data.plan || data.subscription || "",
      credits: data.credits ?? data.credit_balance ?? data.balance ?? 0,
      teamId,
    });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Failed to fetch profile" }, { status: 500 });
  }
}
