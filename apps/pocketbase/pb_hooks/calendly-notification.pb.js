/// <reference path="../pb_data/types.d.ts" />

// Sends an email to NOTIFICATION_EMAIL when a record is created in the
// `calendly_notifications` collection (server-only). The React Router API
// routes (/api/calendly/booked and /api/calendly/status) create these records
// with superuser privileges whenever a client books, reschedules or cancels a
// Calendly appointment — or when Calendly is unavailable and the admin must
// enter the date manually.
onRecordAfterCreateSuccess((e) => {
  const record = e.record;

  const action = record.getString("action");
  const clientEmail = record.getString("client_email");
  const companyName = record.getString("company_name");
  const profileId = record.getString("profile_id");
  const rdvDebut = record.getString("rdv_debut");
  const rdvLieu = record.getString("rdv_lieu");
  const adminNote = record.getString("admin_note");

  const notificationEmail = ($os.getenv("NOTIFICATION_EMAIL") || "contact@monentrepriselocale.fr").trim();
  const rawAppUrl = $app.settings().meta.appUrl || "";
  const appUrl = rawAppUrl.replace(/\/$/, "");
  const adminLink = appUrl && profileId ? appUrl + "/espace/admin/clients/" + profileId : "";

  var subject = "Rendez-vous Calendly";
  var title = "Rendez-vous";
  if (action === "booked") { subject = "Nouveau rendez-vous réservé — " + companyName; title = "Nouveau rendez-vous réservé"; }
  else if (action === "rescheduled") { subject = "Rendez-vous déplacé — " + companyName; title = "Rendez-vous déplacé"; }
  else if (action === "canceled") { subject = "Rendez-vous annulé — " + companyName; title = "Rendez-vous annulé"; }
  else if (action === "manual") { subject = "Rendez-vous à saisir manuellement — " + companyName; title = "Rendez-vous à saisir manuellement"; }

  var rows = "";
  rows += '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Entreprise</td><td style="padding:6px 0;font-weight:700;">' + companyName + "</td></tr>";
  rows += '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Client</td><td style="padding:6px 0;font-weight:700;">' + clientEmail + "</td></tr>";
  if (rdvDebut) {
    rows += '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Date</td><td style="padding:6px 0;font-weight:700;">' + rdvDebut + "</td></tr>";
  }
  if (rdvLieu) {
    rows += '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Lieu</td><td style="padding:6px 0;font-weight:700;">' + rdvLieu + "</td></tr>";
  }

  var html =
    "<h1>" + title + "</h1>" +
    '<table style="border-collapse:collapse;margin:16px 0;">' + rows + "</table>";

  if (adminNote) {
    html += '<div style="background:#fff3e0;border:1px solid #f5c6c0;border-radius:8px;padding:14px 18px;margin:16px 0;color:#b86e00;font-weight:700;">' + adminNote + "</div>";
  }

  if (adminLink) {
    html += '<p><a href="' + adminLink + '" style="display:inline-block;padding:10px 20px;background:#1a2b3c;color:#fff;border-radius:5px;text-decoration:none;font-weight:700;">Voir la fiche client</a></p>';
  }

  html += '<p style="margin-top:24px;color:#5c7086;font-size:13px;">Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>';

  try {
    $app.newMailClient().send(
      new MailerMessage({
        from: { name: "Mon Entreprise Locale" },
        to: [{ address: notificationEmail }],
        subject: subject,
        html: html,
      }),
    );
  } catch (err) {
    $app.logger().error("Echec envoi email rendez-vous", "to", notificationEmail, "err", String(err));
  }

  e.next();
}, "calendly_notifications");
