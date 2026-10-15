/// <reference path="../pb_data/types.d.ts" />

const ADMIN_EMAIL = "contact@monentrepriselocale.fr";

const CATEGORY_LABELS = {
  site_inaccessible: "Site inaccessible",
  display_error: "Erreur d’affichage",
  content_modification: "Modification de contenu",
  question: "Question",
};

const PRIORITY_LABELS = {
  blocking: "Bloquant",
  annoying: "Gênant",
  minor: "Mineur",
};

const STATUS_LABELS = {
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
  closed: "Fermé",
};

function sendMail(to, subject, html) {
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
    $app.logger().error("Échec de l’envoi de l’e-mail ticket", "to", to, "err", String(err));
  }
}

// New ticket → notify admin + confirm to client.
onRecordAfterCreateSuccess((e) => {
  const record = e.record;
  $app.expandRecord(record, ["owner"], null);
  const owner = record.expandedOne("owner");
  const clientEmail = owner ? owner.getString("email") : record.getString("email") || "";
  const subject = record.getString("subject");
  const category = record.getString("category");
  const priority = record.getString("priority");
  const message = record.getString("message") || "";

  const catLabel = CATEGORY_LABELS[category] || category;
  const prioLabel = PRIORITY_LABELS[priority] || priority;

  // To admin
  sendMail(
    ADMIN_EMAIL,
    "Nouveau ticket — " + subject,
    "<h1>Nouveau ticket</h1>" +
      "<p><strong>Sujet :</strong> " + subject + "</p>" +
      "<p><strong>Catégorie :</strong> " + catLabel + "</p>" +
      "<p><strong>Priorité :</strong> " + prioLabel + "</p>" +
      "<p><strong>Description :</strong><br>" + message + "</p>" +
      (clientEmail ? "<p><strong>Client :</strong> " + clientEmail + "</p>" : ""),
  );

  // To client (confirmation)
  if (clientEmail) {
    sendMail(
      clientEmail,
      "Votre ticket a bien été reçu — " + subject,
      "<h1>Votre ticket a été créé</h1>" +
        "<p>Bonjour,</p>" +
        "<p>Nous avons bien reçu votre ticket : <strong>" + subject + "</strong>.</p>" +
        "<p>Notre équipe vous répondra dans les meilleurs délais. Vous pouvez suivre l’évolution depuis votre espace client.</p>" +
        "<p style=\"margin-top:24px;color:#5c7086;font-size:13px;\">Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>",
    );
  }

  e.next();
}, "tickets");

// New message → notify the other party.
onRecordAfterCreateSuccess((e) => {
  const record = e.record;
  $app.expandRecord(record, ["ticket", "owner"], null);
  const ticket = record.expandedOne("ticket");
  const sender = record.expandedOne("owner");
  if (!ticket) { e.next(); return; }

  $app.expandRecord(ticket, ["owner"], null);
  const ticketOwner = ticket.expandedOne("owner");
  const clientEmail = ticketOwner ? ticketOwner.getString("email") : "";
  const authorRole = record.getString("author_role");
  const message = record.getString("message") || "";
  const ticketSubject = ticket.getString("subject") || "Ticket";

  if (authorRole === "client") {
    // Notify admin
    sendMail(
      ADMIN_EMAIL,
      "Nouveau message sur le ticket — " + ticketSubject,
      "<h1>Nouveau message client</h1>" +
        "<p><strong>Ticket :</strong> " + ticketSubject + "</p>" +
        "<p><strong>Message :</strong><br>" + message + "</p>" +
        (clientEmail ? "<p><strong>Client :</strong> " + clientEmail + "</p>" : ""),
    );
  } else {
    // Admin replied → notify client
    if (clientEmail) {
      sendMail(
        clientEmail,
        "Réponse à votre ticket — " + ticketSubject,
        "<h1>Nouvelle réponse</h1>" +
          "<p>Bonjour,</p>" +
          "<p>Notre équipe a répondu à votre ticket : <strong>" + ticketSubject + "</strong>.</p>" +
          "<p><strong>Réponse :</strong><br>" + message + "</p>" +
          "<p>Connectez-vous à votre espace client pour continuer la conversation.</p>" +
          "<p style=\"margin-top:24px;color:#5c7086;font-size:13px;\">Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>",
      );
    }
  }

  e.next();
}, "ticket_messages");

// Ticket status change → notify client.
onRecordAfterUpdateSuccess((e) => {
  const record = e.record;
  const status = record.getString("status");
  $app.expandRecord(record, ["owner"], null);
  const owner = record.expandedOne("owner");
  const clientEmail = owner ? owner.getString("email") : "";
  const subject = record.getString("subject") || "Ticket";
  const statusLabel = STATUS_LABELS[status] || status;

  if (clientEmail) {
    sendMail(
      clientEmail,
      "Mise à jour de votre ticket — " + subject,
      "<h1>Statut de votre ticket mis à jour</h1>" +
        "<p>Bonjour,</p>" +
        "<p>Le statut de votre ticket <strong>" + subject + "</strong> est désormais : <strong>" + statusLabel + "</strong>.</p>" +
        "<p>Connectez-vous à votre espace client pour plus de détails.</p>" +
        "<p style=\"margin-top:24px;color:#5c7086;font-size:13px;\">Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>",
    );
  }

  e.next();
}, "tickets");
