/// <reference path="../pb_data/types.d.ts" />

// Configures the Google OAuth2 provider from environment variables on every
// PocketBase startup. Unlike a migration (which runs once), this hook re-reads
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET on each boot, so the user can set
// them in the environment and restart — no migration or admin UI needed.
//
// If the env vars are not set (or still hold the placeholder values), the hook
// is a no-op and the existing provider config is left untouched. The user can
// also configure Google OAuth directly in the PocketBase admin UI (Users
// collection → Options → OAuth2 providers) as an alternative.
onBootstrap((e) => {
  const clientId = $os.getenv("GOOGLE_CLIENT_ID") || "";
  const clientSecret = $os.getenv("GOOGLE_CLIENT_SECRET") || "";

  const isPlaceholder = (v) =>
    !v ||
    v === "REPLACE_WITH_GOOGLE_CLIENT_ID" ||
    v === "REPLACE_WITH_GOOGLE_CLIENT_SECRET" ||
    v.startsWith("YOUR_") ||
    v.startsWith("GOOGLE_");

  if (isPlaceholder(clientId) || isPlaceholder(clientSecret)) {
    e.next();
    return;
  }

  try {
    const users = $app.findCollectionByNameOrId("users");
    const existing = users.oauth2.providers.find((p) => p.name === "google");

    // Skip if already configured with the same credentials.
    if (
      existing &&
      existing.clientId === clientId &&
      existing.clientSecret === clientSecret
    ) {
      e.next();
      return;
    }

    users.oauth2.providers = [
      ...users.oauth2.providers.filter((p) => p.name !== "google"),
      {
        name: "google",
        clientId: clientId,
        clientSecret: clientSecret,
        authURL: "",
        tokenURL: "",
        userInfoURL: "",
        displayName: "Google",
        pkce: null,
      },
    ];
    users.oauth2.enabled = true;
    $app.save(users);

    $app.logger().info("Google OAuth2 provider configured from environment variables.");
  } catch (err) {
    $app.logger().error("Failed to configure Google OAuth2 provider", "err", String(err));
  }

  e.next();
});
