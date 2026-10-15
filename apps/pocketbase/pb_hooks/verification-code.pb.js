/// <reference path="../pb_data/types.d.ts" />

// Sends the verification code by email when a `verifications` record is
// created with channel = "email". SMS delivery is handled by the
// /api/verify server route (Node has access to the SMS gateway env vars),
// so this hook only handles the email channel.
onRecordAfterCreateSuccess((e) => {
  const record = e.record;
  const channel = String(record.get("channel") || "");

  if (channel !== "email") {
    e.next();
    return;
  }

  const to = String(record.get("contact") || "");
  const code = String(record.get("code") || "");

  if (!to || !code) {
    e.next();
    return;
  }

  const html = `
    <h1>Votre code de vérification</h1>
    <p>Pour confirmer votre demande de site web, saisissez le code suivant :</p>
    <p style="font-size:28px;font-weight:800;letter-spacing:6px;color:#1e4d8c;">${code}</p>
    <p>Ce code est valable 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
    <p style="margin-top:24px;padding:14px 16px;background:#eef5f9;border-left:3px solid #1e4d8c;border-radius:4px;font-size:13px;color:#1a2b3c;"><strong>⚠️ Pensez à vérifier vos spams ou courriers indésirables.</strong> Si l'e-mail s'y trouve, marquez-le comme « non spam » pour recevoir nos prochains messages dans votre boîte de réception.</p>
  `;

  try {
    $app.newMailClient().send(
      new MailerMessage({
        from: { name: "Mon Entreprise Locale" },
        to: [{ address: to }],
        subject: "Votre code de vérification — Mon Entreprise Locale",
        html: html,
      }),
    );
  } catch (err) {
    $app.logger().error("Échec de l'envoi du code de vérification par e-mail", "to", to, "err", String(err));
  }

  e.next();
}, "verifications");
