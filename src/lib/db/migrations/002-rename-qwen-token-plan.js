// Rename provider connections from the legacy `qwen-cloud-token-plan` id to the
// merged `qwen-cloud` id, and normalize the authType for all qwen-cloud connections.
//
// The two providers (qwen-cloud + qwen-cloud-token-plan) were consolidated into
// one (DashScope international endpoint). The registry now declares
// `authType: "apikey"` definitively, but connections created in older versions
// may have `authType: "cookie"` stored in the DB column (from before the
// provider was clearly categorized as apikey). This migration fixes both issues.
//
// Idempotent: the WHERE clauses mean re-runs are no-ops once applied.
export default {
  version: 2,
  name: "rename-qwen-token-plan",
  up(db) {
    // 1. Rename token-plan connections to the merged id.
    db.exec(
      `UPDATE providerConnections SET provider = 'qwen-cloud' WHERE provider = 'qwen-cloud-token-plan';`,
    );
    // 2. Normalize authType: qwen-cloud is an API-key provider (not cookie).
    //    Older connections may have been saved with authType='cookie' from a
    //    time when the registry/auth resolution was ambiguous.
    db.exec(
      `UPDATE providerConnections SET authType = 'apikey' WHERE provider = 'qwen-cloud' AND authType != 'apikey';`,
    );
  },
};
