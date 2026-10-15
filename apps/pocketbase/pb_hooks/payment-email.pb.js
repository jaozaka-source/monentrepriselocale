/// <reference path="../pb_data/types.d.ts" />

// Sends payment confirmation / failure emails when a record is created in the
// `payment_emails` collection. The collection has a unique index on event_id,
// so a duplicate Stripe event cannot create a second record — the email is
// sent exactly once per payment.
onRecordAfterCreateSuccess((e) => {
  const record = e.record;

  const emailType = record.getString("email_type");
  const clientEmail = record.getString("client_email");
  const companyName = record.getString("company_name");
  const siren = record.getString("siren");
  const packName = record.getString("pack_name");
  const billingLabel = record.getString("billing_label");
  const amountTtc = record.getString("amount_ttc_text");
  const paymentDate = record.getString("payment_date");
  const profileId = record.getString("profile_id");
  const invoiceUrl = record.getString("invoice_url");

  const notificationEmail = ($os.getenv("NOTIFICATION_EMAIL") || "contact@monentrepriselocale.fr").trim();
  const rawAppUrl = $app.settings().meta.appUrl || "";
  const appUrl = rawAppUrl.replace(/\/$/, "");
  const espaceLink = appUrl ? appUrl + "/espace" : "";
  const adminLink = appUrl && profileId ? appUrl + "/espace/admin/clients/" + profileId : "";

  const send = (to, subject, html) => {
    if (!to) return;
    try {
      $app.newMailClient().send(
        new MailerMessage({
          from: { name: "Mon Entreprise Locale" },
          to: [{ address: to }],
          subject: subject,
          html: html,
        }),
      );
    } catch (err) {
      $app.logger().error("Echec envoi email paiement", "to", to, "err", String(err));
    }
  };

  if (emailType === "confirmed") {
    // --- Client confirmation email ---
    const clientHtml =
      "<h1>Votre paiement est confirmé</h1>" +
      "<p>Bonjour,</p>" +
      "<p>Nous avons bien reçu votre paiement. Voici le récapitulatif :</p>" +
      '<table style="border-collapse:collapse;margin:16px 0;">' +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Pack</td><td style="padding:6px 0;font-weight:700;">' + packName + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Formule</td><td style="padding:6px 0;font-weight:700;">' + billingLabel + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Montant TTC</td><td style="padding:6px 0;font-weight:700;">' + amountTtc + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Date</td><td style="padding:6px 0;font-weight:700;">' + paymentDate + "</td></tr>" +
      "</table>" +
      "<p><strong>Prochaine étape :</strong> Nous allons vous contacter pour la rencontre de lancement.</p>" +
      (espaceLink ? '<p><a href="' + espaceLink + '" style="display:inline-block;padding:10px 20px;background:#1e4d8c;color:#fff;border-radius:5px;text-decoration:none;font-weight:700;">Accéder à votre espace client</a></p>' : "") +
      (invoiceUrl ? '<p><a href="' + invoiceUrl + '">Télécharger votre facture</a></p>' : "") +
      '<p style="margin-top:24px;color:#5c7086;font-size:13px;">Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>';
    send(clientEmail, "Votre paiement est confirmé — Mon Entreprise Locale", clientHtml);

    // --- Admin notification email ---
    const adminHtml =
      "<h1>Nouveau paiement confirmé</h1>" +
      '<table style="border-collapse:collapse;margin:16px 0;">' +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Entreprise</td><td style="padding:6px 0;font-weight:700;">' + companyName + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">SIREN</td><td style="padding:6px 0;font-weight:700;">' + siren + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Pack</td><td style="padding:6px 0;font-weight:700;">' + packName + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Formule</td><td style="padding:6px 0;font-weight:700;">' + billingLabel + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Montant TTC</td><td style="padding:6px 0;font-weight:700;">' + amountTtc + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Date</td><td style="padding:6px 0;font-weight:700;">' + paymentDate + "</td></tr>" +
      "</table>" +
      (adminLink ? '<p><a href="' + adminLink + '" style="display:inline-block;padding:10px 20px;background:#1a2b3c;color:#fff;border-radius:5px;text-decoration:none;font-weight:700;">Voir la fiche client</a></p>' : "");
    send(notificationEmail, "Nouveau paiement confirmé — " + companyName, adminHtml);
  } else if (emailType === "failed") {
    // --- Client failure email with a link to update the payment method ---
    var payLink = espaceLink ? espaceLink + "/abonnement" : "";
    var clientHtml =
      "<h1>Votre paiement a échoué</h1>" +
      "<p>Bonjour,</p>" +
      "<p>Nous n'avons pas pu encaisser votre dernier paiement. Voici le détail :</p>" +
      '<table style="border-collapse:collapse;margin:16px 0;">' +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Pack</td><td style="padding:6px 0;font-weight:700;">' + packName + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Formule</td><td style="padding:6px 0;font-weight:700;">' + billingLabel + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Montant TTC</td><td style="padding:6px 0;font-weight:700;">' + amountTtc + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Date</td><td style="padding:6px 0;font-weight:700;">' + paymentDate + "</td></tr>" +
      "</table>" +
      "<p><strong>Pour régulariser :</strong> mettez à jour votre moyen de paiement depuis votre espace client, puis le prélèvement sera automatiquement retenté.</p>" +
      (payLink ? '<p><a href="' + payLink + '" style="display:inline-block;padding:10px 20px;background:#1e4d8c;color:#fff;border-radius:5px;text-decoration:none;font-weight:700;">Mettre à jour mon moyen de paiement</a></p>' : "") +
      '<p style="margin-top:24px;color:#5c7086;font-size:13px;">Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>';
    send(clientEmail, "Votre paiement a échoué — Mon Entreprise Locale", clientHtml);

    // --- Admin notification email ---
    var adminHtml =
      "<h1>Échec de paiement</h1>" +
      '<table style="border-collapse:collapse;margin:16px 0;">' +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Entreprise</td><td style="padding:6px 0;font-weight:700;">' + companyName + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">SIREN</td><td style="padding:6px 0;font-weight:700;">' + siren + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Pack</td><td style="padding:6px 0;font-weight:700;">' + packName + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Formule</td><td style="padding:6px 0;font-weight:700;">' + billingLabel + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Montant TTC</td><td style="padding:6px 0;font-weight:700;">' + amountTtc + "</td></tr>" +
      '<tr><td style="padding:6px 16px 6px 0;color:#5c7086;">Date</td><td style="padding:6px 0;font-weight:700;">' + paymentDate + "</td></tr>" +
      "</table>" +
      (adminLink ? '<p><a href="' + adminLink + '" style="display:inline-block;padding:10px 20px;background:#c43c2c;color:#fff;border-radius:5px;text-decoration:none;font-weight:700;">Voir la fiche client</a></p>' : "");
    send(notificationEmail, "Échec de paiement — " + companyName, adminHtml);
  }

  e.next();
}, "payment_emails");
