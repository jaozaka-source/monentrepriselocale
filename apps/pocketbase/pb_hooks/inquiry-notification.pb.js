/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateSuccess((e) => {
  const escape = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
  const record = e.record;

  // Modèle d'e-mail de confirmation de réception d'une demande d'information.
  // Variable {{prenom}} remplacée à l'envoi par le nom et prénom du demandeur.
  const CONFIRMATION_TEMPLATE = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>Merci pour votre demande — monentrepriselocale.fr</title>
</head>
<body style="margin:0;padding:0;background:#EEF2F7;">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EEF2F7;font-size:1px;line-height:1px;">
  Nous avons bien reçu votre demande et nous vous recontactons sous 48 h. Voici les étapes de la réalisation de votre site.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF2F7;">
<tr><td align="center" style="padding:24px 12px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#14213D;">

    <tr>
      <td style="background:#14213D;padding:26px 28px 8px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border-radius:12px;">
          <tr>
            <td style="padding:12px 18px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:26px;color:#14213D;letter-spacing:-0.3px;">
              <span style="font-weight:300;">mon</span><span style="font-weight:700;">entreprise</span><span style="font-weight:700;color:#1F4FB3;">locale</span><span style="display:inline-block;margin-left:5px;padding:0 6px;border:2px solid #14213D;border-radius:5px;font-size:15px;font-weight:700;line-height:20px;vertical-align:2px;">.fr</span>
              <div style="font-size:11px;line-height:14px;font-weight:400;color:#46647D;letter-spacing:0;margin-top:2px;">Créateur de sites web pour les commerces de proximité</div>
            </td>
          </tr>
        </table>
        <div style="font-size:12px;line-height:18px;color:#A9BCD6;padding:8px 0 0 4px;">by <strong style="color:#FFFFFF;">JRConsulting</strong></div>
      </td>
    </tr>
    <tr>
      <td style="background:#14213D;padding:18px 28px 30px 28px;">
        <div style="font-size:28px;line-height:34px;font-weight:700;color:#FFFFFF;">Merci {{prenom}}, votre demande<br>est bien reçue.</div>
        <div style="font-size:16px;line-height:24px;color:#E8F4FB;padding-top:12px;">Parlons de votre <span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;color:#66B3E5;font-size:18px;">commerce.</span></div>
      </td>
    </tr>
    <tr>
      <td style="padding:0;font-size:0;line-height:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="33.3%" height="5" style="background:#1F4FB3;font-size:0;line-height:0;">&nbsp;</td>
          <td width="33.3%" height="5" style="background:#FFFFFF;font-size:0;line-height:0;">&nbsp;</td>
          <td width="33.4%" height="5" style="background:#E4553A;font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
      </td>
    </tr>

    <tr>
      <td style="padding:30px 32px 6px 32px;font-size:16px;line-height:25px;color:#14213D;">
        <p style="margin:0 0 14px 0;">Bonjour {{prenom}},</p>
        <p style="margin:0 0 14px 0;">Merci d'avoir pris le temps de nous écrire : nous avons bien reçu votre demande d'information et nous vous en remercions.</p>
        <p style="margin:0 0 14px 0;"><strong>Nous vous recontactons sous 48&nbsp;h</strong> pour un premier échange, <strong>sans engagement</strong>, afin de faire connaissance, de comprendre votre commerce et de vous conseiller la formule la plus adaptée.</p>
        <p style="margin:0;">Et bonne nouvelle : <strong>dès que nous aurons échangé, votre site est réalisé rapidement</strong>. Voici comment les choses se passent.</p>
      </td>
    </tr>

    <tr>
      <td style="padding:26px 32px 4px 32px;">
        <div style="font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;color:#E4553A;text-transform:uppercase;">Le processus, étape par étape</div>
        <div style="font-size:22px;line-height:28px;font-weight:700;color:#14213D;padding-top:4px;">De votre demande à votre site en ligne</div>
      </td>
    </tr>

    <tr><td style="padding:18px 32px 0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="44" valign="top"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="32" height="32" align="center" valign="middle" style="background:#14213D;border-radius:16px;color:#FFFFFF;font-size:16px;font-weight:700;line-height:32px;">&#10003;</td></tr></table></td>
        <td valign="top" style="font-size:15px;line-height:22px;color:#14213D;">
          <strong style="font-size:16px;">Votre demande — c'est fait&nbsp;!</strong><br>
          <span style="color:#46647D;">Nous l'avons reçue. Rien d'autre à faire pour le moment.</span>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:16px 32px 0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="44" valign="top"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="32" height="32" align="center" valign="middle" style="background:#E4553A;border-radius:16px;color:#FFFFFF;font-size:16px;font-weight:700;line-height:32px;">2</td></tr></table></td>
        <td valign="top" style="font-size:15px;line-height:22px;color:#14213D;">
          <strong style="font-size:16px;">Premier échange, sans engagement</strong><br>
          <span style="color:#46647D;">Nous vous contactons sous 48&nbsp;h (avec plaisir directement dans votre boutique si vous le souhaitez). Vous nous parlez de votre activité, de vos clients et de vos envies ; nous vous conseillons la formule adaptée&nbsp;: <em>Essentiel</em> (site vitrine), <em>Rendez-vous</em> (prise de rendez-vous en ligne) ou <em>Boutique</em> (vente en ligne).</span>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:16px 32px 0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="44" valign="top"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="32" height="32" align="center" valign="middle" style="background:#E4553A;border-radius:16px;color:#FFFFFF;font-size:16px;font-weight:700;line-height:32px;">3</td></tr></table></td>
        <td valign="top" style="font-size:15px;line-height:22px;color:#14213D;">
          <strong style="font-size:16px;">Vous choisissez et vous validez</strong><br>
          <span style="color:#46647D;">Vous choisissez votre formule et sa durée, puis vous signez votre contrat en ligne. <strong style="color:#14213D;">Aucun frais de création</strong> : un simple abonnement, rien à avancer.</span>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:16px 32px 0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="44" valign="top"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="32" height="32" align="center" valign="middle" style="background:#E4553A;border-radius:16px;color:#FFFFFF;font-size:16px;font-weight:700;line-height:32px;">4</td></tr></table></td>
        <td valign="top" style="font-size:15px;line-height:22px;color:#14213D;">
          <strong style="font-size:16px;">Nous créons votre site sur mesure</strong><br>
          <span style="color:#46647D;">Vous nous transmettez vos éléments (logo, photos, horaires, services…) et nous concevons un site à votre image, pensé pour votre métier — pas un modèle générique. Vous le relisez, et nous ajustons jusqu'à ce qu'il vous plaise.</span>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:16px 32px 0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="44" valign="top"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="32" height="32" align="center" valign="middle" style="background:#E4553A;border-radius:16px;color:#FFFFFF;font-size:16px;font-weight:700;line-height:32px;">5</td></tr></table></td>
        <td valign="top" style="font-size:15px;line-height:22px;color:#14213D;">
          <strong style="font-size:16px;">Mise en ligne et suivi — clé en main</strong><br>
          <span style="color:#46647D;">Nous mettons votre site en ligne, nous l'hébergeons et nous l'entretenons. <strong style="color:#14213D;">Hébergement, maintenance et modifications sont inclus</strong> : vous vous concentrez sur votre commerce, nous nous occupons du reste.</span>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:28px 32px 0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F2F8FC;border-radius:12px;">
        <tr><td style="padding:20px 22px;font-size:15px;line-height:23px;color:#14213D;">
          <div style="font-size:17px;line-height:22px;font-weight:700;padding-bottom:8px;">Pour aller encore plus vite</div>
          <div style="color:#46647D;padding-bottom:8px;">Si vous le pouvez, rassemblez dès maintenant ces quelques éléments (rien d'obligatoire, nous vous guiderons&nbsp;!) :</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:23px;color:#14213D;">
            <tr><td valign="top" style="padding-right:8px;color:#E4553A;font-weight:700;">&#8226;</td><td>votre <strong>logo</strong>, s'il existe (sinon, nous vous aiderons) ;</td></tr>
            <tr><td valign="top" style="padding-right:8px;color:#E4553A;font-weight:700;">&#8226;</td><td>quelques <strong>photos</strong> de votre commerce, de vos produits ou de vos réalisations ;</td></tr>
            <tr><td valign="top" style="padding-right:8px;color:#E4553A;font-weight:700;">&#8226;</td><td>vos <strong>horaires</strong>, votre adresse et vos coordonnées ;</td></tr>
            <tr><td valign="top" style="padding-right:8px;color:#E4553A;font-weight:700;">&#8226;</td><td>la liste de vos <strong>services ou produits</strong>, avec vos tarifs si vous souhaitez les afficher ;</td></tr>
            <tr><td valign="top" style="padding-right:8px;color:#E4553A;font-weight:700;">&#8226;</td><td>un ou deux <strong>sites que vous aimez</strong>, pour nous inspirer.</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>

    <tr><td align="center" style="padding:30px 32px 6px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" style="background:#E4553A;border-radius:28px;">
          <a href="https://monentrepriselocale.fr/" style="display:inline-block;padding:15px 30px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;">Découvrir nos formules</a>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:24px 32px 8px 32px;font-size:15px;line-height:24px;color:#14213D;">
      <p style="margin:0 0 10px 0;">Une question en attendant notre appel ? <strong>Répondez simplement à cet email</strong> ou contactez-nous :</p>
      <p style="margin:0;color:#46647D;">
        &#9993;&nbsp; <a href="mailto:contact@monentrepriselocale.fr" style="color:#1F4FB3;text-decoration:none;font-weight:700;">contact@monentrepriselocale.fr</a><br>
        &#9742;&nbsp; <a href="tel:+33647393938" style="color:#1F4FB3;text-decoration:none;font-weight:700;">+33&nbsp;6&nbsp;47&nbsp;39&nbsp;39&nbsp;38</a><br>
        &#127760;&nbsp; <a href="https://monentrepriselocale.fr/" style="color:#1F4FB3;text-decoration:none;font-weight:700;">monentrepriselocale.fr</a>
      </p>
    </td></tr>

    <tr><td style="padding:18px 32px 32px 32px;font-size:16px;line-height:24px;color:#14213D;">
      À très bientôt,<br>
      <strong>L'équipe monentrepriselocale.fr</strong>
    </td></tr>

    <tr>
      <td style="background:#14213D;padding:22px 32px;font-size:12px;line-height:18px;color:#A9BCD6;">
        <strong style="color:#FFFFFF;">monentrepriselocale.fr</strong> — créateur de sites web pour les commerces de proximité<br>
        by JRConsulting · 60 rue François-Ier, 75008 Paris<br><br>
        Vous recevez cet email car vous avez rempli le formulaire de contact de monentrepriselocale.fr. Vos informations sont utilisées uniquement pour traiter votre demande.
      </td>
    </tr>

  </table>

</td></tr>
</table>
</body>
</html>`;

  // --- 1. Notification interne à l'équipe ---
  const adminHtml = `
    <h1>Nouvelle demande de site web</h1>
    <p><strong>Commerce :</strong> ${escape(record.get("business_name"))}</p>
    <p><strong>Activité :</strong> ${escape(record.get("business_type"))}</p>
    <p><strong>Besoins :</strong> ${escape(record.get("needs"))}</p>
    <p><strong>Localisation :</strong> ${escape(record.get("location"))}</p>
    <p><strong>Contact :</strong> ${escape(record.get("contact_name"))}</p>
    <p><strong>Email :</strong> ${escape(record.get("email"))}</p>
    <p><strong>Téléphone :</strong> ${escape(record.get("phone"))}</p>
    <p><strong>Message :</strong> ${escape(record.get("message"))}</p>
  `;
  try {
    $app.newMailClient().send(new MailerMessage({
      from: { name: "Mon Entreprise Locale" },
      to: [{ address: "contact@monentrepriselocale.fr" }],
      subject: "Nouvelle demande de site web — " + String(record.get("business_name")),
      html: adminHtml,
    }));
  } catch (err) {
    $app.logger().error("Échec de l'envoi de la notification de demande", "err", String(err));
  }

  // --- 2. E-mail de confirmation au demandeur ---
  const contactName = String(record.get("contact_name") || "").trim();
  const recipient = String(record.get("email") || "").trim();

  if (recipient) {
    let personalized;
    if (contactName) {
      // Remplace {{prenom}} par le nom ET prénom fournis par le client.
      personalized = CONFIRMATION_TEMPLATE.replace(/\{\{prenom\}\}/g, escape(contactName));
    } else {
      // Repli : aucun nom — on retire le placeholder sans laisser de trace.
      personalized = CONFIRMATION_TEMPLATE
        .replace(/Merci \{\{prenom\}\}, /g, "Merci, ")
        .replace(/Bonjour \{\{prenom\}\},/g, "Bonjour,");
    }

    try {
      $app.newMailClient().send(new MailerMessage({
        from: { name: "monentrepriselocale.fr", address: "contact@monentrepriselocale.fr" },
        to: [{ address: recipient }],
        subject: "Merci pour votre demande — nous revenons vers vous sous 48 h",
        html: personalized,
      }));
    } catch (err) {
      $app.logger().error("Échec de l'envoi de l'e-mail de confirmation au demandeur", "to", recipient, "err", String(err));
    }
  }

  e.next();
}, "inquiries");
