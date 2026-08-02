"use client";

import { useState } from "react";
import { Card, Button, Badge, EmptyState } from "@/shared/components";
import { COMBO_TEMPLATES } from "@/shared/constants/comboTemplates";
import { getStrategyMeta, getStrategyLabel } from "./helpers";
import { resolveProviderId, getProviderAlias } from "@/shared/constants/providers";

// ComboTemplatesTab — redesigned template gallery with provider availability badges.
// Replaces the old ComboTemplates.js component.
export default function ComboTemplatesTab({ combos, connections, modelIndex = {}, onApply }) {
  const [applying, setApplying] = useState(null);

  const connectedProviders = new Set(
    connections?.filter((c) => c.isActive !== false).map((c) => c.provider) || [],
  );
  const existingNames = new Set((combos || []).map((c) => c.name));

  // Resolve a template's model references to ACTUAL connected providers that
  // carry the same model. The model name is the PRIMARY key — templates no
  // longer tether a model to one provider. An optional preferred provider is
  // only a hint: it wins when connected, otherwise we fall back to any other
  // connected provider that exposes the same model (e.g. template wants
  // "claude-opus-4-7" on cc, but the user only has kiro connected — we use
  // kiro). Supports both formats:
  //   - "claude-opus-4-7"           (model name only — preferred from template.preferredProviders)
  //   - "cc/claude-opus-4-7"        (legacy: provider/model — preferred embedded)
  const resolveModels = (template) => (template.models || []).map((ref) => {
    const slash = ref.indexOf("/");
    const hasProviderPrefix = slash > 0;
    const modelName = hasProviderPrefix ? ref.slice(slash + 1) : ref;
    const embeddedPreferred = hasProviderPrefix ? ref.slice(0, slash) : "";
    // Preferred hint: explicit in the ref (legacy) or in preferredProviders map.
    const preferred = embeddedPreferred || (template.preferredProviders || {})[modelName] || "";
    const preferredId = preferred ? resolveProviderId(preferred) : "";
    // modelIndex is keyed by provider ALIAS (from /api/models: provider=alias).
    // connectedProviders is keyed by provider ID (connections[].provider=id).
    // Canonicalize candidates alias→id so the comparison actually matches.
    const candidates = (modelIndex[modelName] || [])
      .map((p) => resolveProviderId(p))
      .filter((p) => connectedProviders.has(p));
    if (preferredId && candidates.includes(preferredId)) {
      // Store with the app-wide ALIAS prefix (cc/claude-opus-4-7) so modelCaps
      // lookups and ModelSelectModal highlighting match other combos.
      const alias = getProviderAlias(preferredId);
      return { ref, modelName, provider: preferredId, providerAlias: alias, full: `${alias}/${modelName}`, available: true };
    }
    if (candidates.length > 0) {
      const alias = getProviderAlias(candidates[0]);
      return { ref, modelName, provider: candidates[0], providerAlias: alias, full: `${alias}/${modelName}`, available: true, resolvedFrom: preferred };
    }
    return { ref, modelName, provider: preferredId || preferred, full: hasProviderPrefix ? ref : modelName, available: false };
  });

  const handleApply = async (template) => {
    setApplying(template.id);
    try {
      // Use resolved providers, not the template's hardcoded ones. Only models
      // that resolved to a real connected provider are usable.
      const resolved = resolveModels(template);
      const usable = resolved.filter((m) => m.available);
      const models = usable.map((m) => m.full);
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: template.name, models, kind: null }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to create combo from template");
        return;
      }
      // IMPORTANT: /api/settings does a shallow merge of top-level keys, so
      // PATCHing { comboStrategies: {...} } would REPLACE the whole object and
      // wipe every other combo's strategy. Fetch current strategies first and
      // merge the new entry in.
      const cur = await fetch("/api/settings").then((r) => r.json()).catch(() => ({}));
      // Templates can ship a rich strategyConfig (thinking, autoScale, role
      // models). Fall back to { fallbackStrategy } for legacy templates.
      // Role models (manager/judge/staff/audit) are resolved to connected
      // providers the same way the member models are.
      const strategyConfig = template.strategyConfig ? { ...template.strategyConfig } : { fallbackStrategy: template.strategy };
      // Role models may be model-name-only (new format) or provider/model
      // (legacy). Resolve by model name against the resolved members map.
      const resolvedByName = Object.fromEntries(resolved.map((m) => [m.modelName, m.full]));
      for (const roleKey of ["managerModel", "staffModel", "auditModel", "judgeModel"]) {
        const roleRef = strategyConfig[roleKey];
        if (!roleRef) continue;
        const slash = roleRef.indexOf("/");
        const roleModelName = slash > 0 ? roleRef.slice(slash + 1) : roleRef;
        if (resolvedByName[roleModelName]) {
          strategyConfig[roleKey] = resolvedByName[roleModelName];
        }
      }
      const merged = {
        ...(cur?.comboStrategies || {}),
        [template.name]: strategyConfig,
      };
      const stratRes = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboStrategies: merged }),
      });
      if (!stratRes.ok) {
        const err = await stratRes.json().catch(() => ({}));
        alert(err.error || "Failed to apply template strategy");
        return;
      }
      if (onApply) onApply();
    } catch (err) {
      alert("Failed to apply template: " + (err?.message || String(err)));
    } finally {
      setApplying(null);
    }
  };

  if (COMBO_TEMPLATES.length === 0) {
    return (
      <EmptyState icon="dashboard_customize" title="No templates available" description="Combo templates will appear here when added." />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-1">
        <h2 className="text-sm font-semibold text-text-main">Combo Templates</h2>
        <p className="text-xs text-text-muted mt-0.5">One-click prebuilt combos. Provider availability is checked automatically.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COMBO_TEMPLATES.map((tpl) => {
          // Availability is model-based, not provider-based: a template model is
          // "ready" if ANY connected provider carries it (not just the preferred one).
          const resolved = resolveModels(tpl);
          const readyCount = resolved.filter((m) => m.available).length;
          const totalCount = resolved.length;
          const isCreated = existingNames.has(tpl.name);
          const meta = getStrategyMeta(tpl.strategy);
          const allConnected = readyCount === totalCount;

          return (
            <Card key={tpl.id} padding="sm" className="flex flex-col gap-3 hover:border-primary/20 transition-all">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${meta.color}15` }}>
                    <span className="material-symbols-outlined text-[18px]" style={{ color: meta.color }}>{tpl.icon || meta.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-main">{tpl.name}</p>
                    <Badge variant={meta.badge} size="sm">{getStrategyLabel(tpl.strategy)}</Badge>
                  </div>
                </div>
                {isCreated && <Badge variant="success" size="sm" dot>Created</Badge>}
              </div>

              {/* Description */}
              <p className="text-xs text-text-muted leading-relaxed">{tpl.description}</p>

              {/* Model chips — resolved to connected providers */}
              <div className="flex flex-wrap gap-1">
                {resolved.slice(0, 4).map((m, i) => (
                  <code
                    key={i}
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                      m.available ? "bg-black/5 text-text-muted dark:bg-white/5" : "bg-red-500/10 text-red-500"
                    }`}
                    title={m.available ? `Resolved to ${m.provider}` : `No connected provider has ${m.modelName}`}
                  >
                    <span className={m.available ? "text-success" : "text-red-500"}>
                      {m.available ? "✓" : "✗"}
                    </span>
                    <span className="truncate max-w-[110px]">{m.modelName}</span>
                    {m.available && (
                      <span className="rounded bg-black/10 px-0.5 text-[9px] dark:bg-white/10">{m.provider}</span>
                    )}
                  </code>
                ))}
                {resolved.length > 4 && (
                  <span className="text-[10px] text-text-muted">+{resolved.length - 4} more</span>
                )}
              </div>

              {/* Resolved provider availability */}
              <div className="flex flex-wrap gap-1">
                {resolved.map((m) => {
                  const resolvedFromId = m.resolvedFrom ? resolveProviderId(m.resolvedFrom) : "";
                  const providerLabel = m.available
                    ? `${m.provider}${m.resolvedFrom && resolvedFromId !== m.provider ? ` (via ${m.resolvedFrom})` : ""}`
                    : `${m.provider || "?"} (missing)`;
                  const isConn = m.available;
                  return (
                    <span
                      key={m.ref}
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        isConn ? "bg-success/10 text-success" : "bg-surface-2 text-text-muted"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[10px]">{isConn ? "check_circle" : "radio_button_unchecked"}</span>
                      {providerLabel}
                    </span>
                  );
                })}
              </div>

              {/* Apply button */}
              <div className="mt-auto pt-1">
                <Button
                  size="sm"
                  fullWidth
                  variant={isCreated ? "secondary" : "primary"}
                  icon={applying === tpl.id ? "progress_activity" : "add"}
                  disabled={isCreated || applying === tpl.id || !allConnected}
                  onClick={() => handleApply(tpl)}
                >
                  {applying === tpl.id ? "Creating..." : isCreated ? "Already Created" : allConnected ? "Apply Template" : `Apply (${readyCount}/${totalCount} ready)`}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
