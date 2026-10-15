/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateSuccess((e) => {
  const to = String(e.record.get("email") || "");
  const code = String(e.record.get("code") || "");
  if (!to || !code) {
    e.next();
    return;
  }
  try {
    $app.newMailClient().send(
      new MailerMessage({
        from: { name: "Mon Entreprise Locale" },
        to: [{ address: to }],
        subject: "Votre code de signature — Mon Entreprise Locale",
        html:
          "<h1>Code de signature</h1>" +
          "<p>Pour signer votre contrat, saisissez ce code dans votre espace client :</p>" +
          '<p style="font-size:28px;font-weight:800;letter-spacing:6px;color:#1e4d8c;">' +
          code +
          "</p>" +
          "<p>Ce code est valable 10 minutes. Cinq essais maximum. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>",
      }),
    );
  } catch (err) {
    $app.logger().error("Echec envoi code de signature", "to", to, "err", String(err));
  }
  e.next();
}, "signature_challenges");

onRecordAfterCreateSuccess((e) => {
  const record = e.record;
  const ownerId = String(record.get("owner") || "");
  const signedAtStr = String(record.get("signed_at") || "");

  // Deduplicate: the cadre + annex are signed together in one session, which
  // creates two signature records with the same owner and signed_at. Only the
  // first one should send the email (with the combined PDF). If another record
  // for the same signing session already exists, skip.
  if (ownerId && signedAtStr) {
    try {
      const existing = $app.findRecordsByFilter(
        "signatures",
        "owner = {:owner} && signed_at = {:signedAt} && id != {:id}",
        "-created",
        1,
        0,
        { owner: ownerId, signedAt: signedAtStr, id: record.id },
      );
      if (existing.length > 0) {
        e.next();
        return;
      }
    } catch (err) {
      $app.logger().error("Dedup signatures impossible", "err", String(err));
    }
  }

  // Load the company name for the attachment filename.
  let companyName = "";
  if (ownerId) {
    try {
      const profiles = $app.findRecordsByFilter(
        "client_profiles",
        "owner = {:owner}",
        "",
        1,
        0,
        { owner: ownerId },
      );
      if (profiles.length > 0) {
        companyName = profiles[0].getString("company_name");
      }
    } catch (err) {
      $app.logger().error("Lecture du profil client impossible", "err", String(err));
    }
  }

  // Build the attachment filename:
  // Contrat-monentrepriselocale-[denomination]-[date].pdf
  var sanitize = function (s) {
    s = s || "";
    s = s.replace(/[^a-zA-Z0-9-]/g, "-");
    s = s.replace(/-+/g, "-");
    s = s.replace(/^-|-$/g, "");
    return s || "client";
  };
  var datePart = signedAtStr.length >= 10 ? signedAtStr.slice(0, 10) : "";
  var attachmentName = "Contrat-monentrepriselocale-" + sanitize(companyName) + "-" + datePart + ".pdf";

  const to = String(record.get("signer_email") || "");
  const admin = String(record.get("admin_email") || "");
  const filename = String(record.get("pdf") || "");
  let attachments = [];
  if (filename) {
    let reader;
    try {
      const fs = $app.newFilesystem();
      reader = fs.getReader(record.baseFilesPath() + "/" + filename);
      const size = reader.size();
      const buf = new Array(size);
      let offset = 0;
      while (offset < size) {
        const chunk = new Array(size - offset);
        const n = reader.read(chunk);
        if (n <= 0) break;
        for (let i = 0; i < n; i++) buf[offset + i] = chunk[i];
        offset += n;
      }
      // The PDF read here is the immutable signed file (same SHA-256 as the
      // one stored in the signatures + documents records), certificate page
      // included.
      attachments = [{ filename: attachmentName, content: buf.slice(0, offset) }];
    } catch (err) {
      $app.logger().error("Lecture du PDF signe impossible", "err", String(err));
    } finally {
      if (reader) {
        try { reader.close(); } catch (_) {}
      }
    }
  }

  // Build the link to "Mes documents" in the client space.
  var rawAppUrl = ($app.settings().meta.appUrl || "").replace(/\/$/, "");
  var documentsLink = rawAppUrl ? rawAppUrl + "/espace/documents" : "";

  var html =
    "<h1>Votre contrat est signé</h1>" +
    "<p>Vous trouverez en pièce jointe le contrat signé (conditions particulières, contrat cadre et certificat de signature). " +
    (documentsLink
      ? 'Une copie est aussi disponible dans <a href="' + documentsLink + '">Mes documents</a> de votre espace client.'
      : "Une copie est aussi disponible dans Mes documents de votre espace client.") +
    "</p>" +
    "<p>Ce document est figé : il ne peut plus être modifié.</p>";

  const send = (address) => {
    if (!address) return;
    try {
      $app.newMailClient().send(
        new MailerMessage({
          from: { name: "Mon Entreprise Locale" },
          to: [{ address: address }],
          subject: "Contrat signé — Mon Entreprise Locale",
          html: html,
          attachments: attachments,
        }),
      );
    } catch (err) {
      $app.logger().error("Echec envoi contrat signe", "to", address, "err", String(err));
    }
  };

  send(to);
  if (admin && admin !== to) send(admin);
  e.next();
}, "signatures");
