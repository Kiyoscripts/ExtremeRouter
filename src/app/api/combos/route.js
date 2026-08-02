import { NextResponse } from "next/server";
import { getCombos, createCombo, getComboByName } from "@/lib/localDb";
import { validateComboDefinition } from "open-sse/services/comboConfig.js";
import { validateComboRoles } from "open-sse/services/providerCapabilities.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ combos: await getCombos() });
  } catch (error) {
    console.error("Error fetching combos:", error);
    return NextResponse.json({ error: "Failed to fetch combos" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const candidate = {
      name: typeof body.name === "string" ? body.name.trim() : body.name,
      models: Array.isArray(body.models) ? body.models.map((m) => typeof m === "string" ? m.trim() : m) : body.models,
      kind: body.kind || "llm",
      strategyConfig: body.strategyConfig || {},
    };
    const validation = validateComboDefinition(candidate);
    if (!validation.valid) return NextResponse.json({ error: validation.errors[0], errors: validation.errors }, { status: 400 });

    const strategy = candidate.strategyConfig?.fallbackStrategy || "fallback";
    const violations = validateComboRoles(strategy, candidate.strategyConfig, candidate.models);
    if (violations.length) return NextResponse.json({ error: violations[0].reason, violations }, { status: 400 });

    if (await getComboByName(candidate.name)) return NextResponse.json({ error: "Combo name already exists" }, { status: 409 });
    return NextResponse.json(await createCombo(candidate), { status: 201 });
  } catch (error) {
    console.error("Error creating combo:", error);
    return NextResponse.json({ error: "Failed to create combo" }, { status: 500 });
  }
}
