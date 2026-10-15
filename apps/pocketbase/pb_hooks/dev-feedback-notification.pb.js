/// <reference path="../pb_data/types.d.ts" />

const DEV_ADMIN_EMAIL = "contact@monentrepriselocale.fr";

function devSendMail(to, subject, html) {
  try {
    $app.newMailClient().send(
      new MailerMessage({
        from: { name: "Espace client — Mon Entreprise Locale" },
        to: [{ address: to }],
        subject: subject,
        html: html,
      }),
    );
  } catch (err) {
    $app.logger().error("Échec de l’envoi de l’e-mail de notification", "to", to, "err", String(err));
  }
}

// client_contents: when submitted flips to true, notify the admin.
onRecordUpdate((e) => {
  const record = e.record;
  let wasSubmitted = false;
  try {
    const old = $app.findRecordById("client_contents", record.id);
    wasSubmitted = old.getBool("submitted");
  } catch (_) {}
  const nowSubmitted = record.getBool("submitted");

  if (!wasSubmitted && nowSubmitted) {
    $app.expandRecord(record, ["owner"], null);
    const owner = record.expandedOne("owner");
    const clientEmail = owner ? owner.getString("email") : "";
    devSendMail(
      DEV_ADMIN_EMAIL,
      "Contenus du client reçus",
      "<h1>Contenus déposés par le client</h1>" +
        "<p>Le client a indiqué avoir transmis tous ses contenus (présentation, services, horaires, photos…).</p>" +
        (clientEmail ? "<p><strong>Client :</strong> " + clientEmail + "</p>" : "") +
        "<p>Connectez-vous à l’administration pour récupérer les fichiers et les informations.</p>",
    );
  }

  e.next();
}, "client_contents");

// client_profiles: when mockup_status changes, notify the admin.
onRecordUpdate((e) => {
  const record = e.record;
  let oldStatus = "";
  try {
    const old = $app.findRecordById("client_profiles", record.id);
    oldStatus = old.getString("mockup_status");
  } catch (_) {}
  const newStatus = record.getString("mockup_status");

  if (oldStatus !== newStatus && (newStatus === "validated" || newStatus === "changes_requested")) {
    $app.expandRecord(record, ["owner"], null);
    const owner = record.expandedOne("owner");
    const clientEmail = owner ? owner.getString("email") : "";
    const companyName = record.getString("company_name") || "";
    const feedback = record.getString("mockup_feedback") || "";
    const label = newStatus === "validated" ? "a validé la maquette" : "demande des modifications";

    devSendMail(
      DEV_ADMIN_EMAIL,
      "Retour client sur la maquette — " + (companyName || "client"),
      "<h1>Retour sur la maquette</h1>" +
        "<p>Le client <strong>" + label + "</strong>.</p>" +
        (companyName ? "<p><strong>Entreprise :</strong> " + companyName + "</p>" : "") +
        (clientEmail ? "<p><strong>Client :</strong> " + clientEmail + "</p>" : "") +
        (feedback ? "<p><strong>Commentaires :</strong><br>" + feedback + "</p>" : ""),
    );
  }

  e.next();
}, "client_profiles");
