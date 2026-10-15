/// <reference path="../pb_data/types.d.ts" />

// On Google OAuth sign-in, mark the record as verified (Google confirmed the
// email) and grant the admin role if the email is in ADMIN_EMAILS (best effort —
// the env var must be set in the PocketBase process to take effect here; the
// Node /api/auth/sync-role endpoint is the reliable path for admin assignment).
onRecordAuthWithOAuth2Request((e) => {
  e.record.set("verified", true);

  const adminEmails = ($os.getenv("ADMIN_EMAILS") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.includes((e.record.email() || "").toLowerCase())) {
    e.record.set("role", "admin");
  }

  e.next();
}, "users");
