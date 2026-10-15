/// <reference path="../pb_data/types.d.ts" />

// Sends an email to the client each time their onboarding step changes.
// The /api/steps/advance (and admin advance/back) actions create a step_history
// record with the superuser client; this hook fires on that create and emails
// the owner. If an email_templates record exists for the step, its subject and
// body are used (with {{step}}, {{step_label}}, {{comment}} placeholders);
// otherwise the built-in default template is used.
onRecordAfterCreateSuccess((e) => {
  const record = e.record;

  $app.expandRecord(record, ["owner"], null);
  const owner = record.expandedOne("owner");

  if (!owner) {
    e.next();
    return;
  }

  const to = owner.getString("email");
  const step = record.getString("step");
  const action = record.getString("action");
  const comment = record.getString("comment") || "";

  if (!to || !step) {
    e.next();
    return;
  }

  const stepLabels = {
    "1.1": "Profil entreprise",
    "1.2": "Représentant légal",
    "1.3": "Choix du pack",
    "1.4": "Contrat",
    "1.5": "Signature",
    "2.1": "Paiement",
    "3.1": "Rencontre",
    "3.2": "Vos contenus",
    "3.3": "Création",
    "3.4": "Contrôle qualité",
    "3.5": "Présentation",
    "3.6": "Mise en ligne",
    "4.1": "Site en ligne",
  };

  const label = stepLabels[step] || step;
  const verb = action === "reset" ? "réinitialisée à" : "passée à";

  // Look for a custom template for this step.
  let customSubject = "";
  let customBody = "";
  try {
    const found = $app.findRecordsByFilter(
      "email_templates",
      "step = {:step}",
      "-created",
      1,
      0,
      { step: step },
    );
    if (found.length > 0) {
      customSubject = found[0].getString("subject");
      customBody = found[0].getString("body");
    }
  } catch (err) {
    $app.logger().error("Échec de la lecture du modèle d'e-mail", "err", String(err));
  }

  const subject = customSubject || ("Mise à jour de votre projet — " + label);

  let html;
  if (customBody) {
    html = customBody
      .replace(/\{\{step_label\}\}/g, label)
      .replace(/\{\{step\}\}/g, step)
      .replace(/\{\{comment\}\}/g, comment);
  } else {
    html = `
      <h1>Votre projet avance</h1>
      <p>Bonjour,</p>
      <p>Votre étape a été ${verb} : <strong>${label}</strong> (${step}).</p>
      ${comment ? `<p style="padding:14px 16px;background:#eef5f9;border-left:3px solid #1e4d8c;border-radius:4px;">${comment}</p>` : ""}
      <p>Connectez-vous à votre espace client pour continuer : votre tableau de bord affiche l'étape en cours et le bouton « Continuer ».</p>
      <p style="margin-top:24px;color:#5c7086;font-size:13px;">Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>
    `;
  }

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
    $app.logger().error("Échec de l'envoi de la notification d'étape", "to", to, "err", String(err));
  }

  e.next();
}, "step_history");
