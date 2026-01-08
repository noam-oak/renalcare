// services/mailService.js
const nodemailer = require('nodemailer');

// --- Transporteur SMTP Gmail ---
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,          // ✅ port STARTTLS
  secure: false,      // ✅ false avec le port 587
  auth: {
    user: process.env.MAIL_USER, // ton adresse Gmail
    pass: process.env.MAIL_PASS, // mot de passe d'application
  },
});

// Vérification au démarrage (debug)
transporter.verify((err, success) => {
  if (err) {
    console.error('[MAIL] Erreur de configuration SMTP :', err.message);
  } else {
    console.log('[MAIL] Transporteur SMTP prêt.');
  }
});

// -----------------------------------------------------
// 1) Email envoyé à l'ADMIN quand quelqu'un remplit le formulaire
// -----------------------------------------------------
async function sendContactNotification(contact) {
  const mailOptions = {
    from: `"RenalCare" <${process.env.MAIL_USER}>`,
    to: process.env.MAIL_USER, // tu reçois la notification sur TON mail
    subject: `🔥 Nouvelle demande via le formulaire (${contact.type})`,
    html: `
      <h2>Nouvelle demande de contact</h2>
      <p><strong>Nom :</strong> ${contact.prenom} ${contact.nom}</p>
      <p><strong>Type de compte :</strong> ${contact.type}</p>
      <p><strong>Email :</strong> ${contact.email}</p>
      <p><strong>Téléphone :</strong> ${contact.telephone || 'Non renseigné'}</p>
      <p><strong>Sujet :</strong> ${contact.sujet}</p>
      <p><strong>Message :</strong></p>
      <p>${contact.message}</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

// -----------------------------------------------------
// 2) Email envoyé AU DEMANDEUR quand l'admin accepte / refuse
// -----------------------------------------------------
function getInscriptionLink(type) {
  // IMPORTANT : ici on met bien les URL que ton serveur sert
  // Dans app.js tu as : `/medecin/register` et `/patient/register`
  return type === 'medecin'
    ? 'http://51.21.250.236:3000/medecin/register'
    : 'http://51.21.250.236:3000/patient/register';
}

async function sendAccountDecisionEmail(contact, accepted) {
  const inscriptionLink = getInscriptionLink(contact.type);

  const subject = accepted
    ? 'Votre demande de création de compte a été acceptée'
    : 'Votre demande de création de compte a été refusée';

  const htmlAccepted = `
    <p>Bonjour ${contact.prenom} ${contact.nom},</p>
    <p>Votre demande de création de compte <strong>${contact.type}</strong> a été <strong>acceptée</strong>.</p>
    <p>Vous pouvez maintenant finaliser votre inscription en suivant ce lien :</p>
    <p><a href="${inscriptionLink}">${inscriptionLink}</a></p>
    <p>Cordialement,<br>L'équipe RenalCare</p>
  `;

  const htmlRefused = `
    <p>Bonjour ${contact.prenom} ${contact.nom},</p>
    <p>Votre demande de création de compte a été <strong>refusée</strong>.</p>
    <p>Si besoin, vous pouvez nous recontacter pour plus d'informations.</p>
    <p>Cordialement,<br>L'équipe RenalCare</p>
  `;

  const mailOptions = {
    from: `"RenalCare" <${process.env.MAIL_USER}>`,
    to: contact.email,
    subject,
    html: accepted ? htmlAccepted : htmlRefused,
  };

  await transporter.sendMail(mailOptions);
}

// Wrappers pratiques pour l'admin
async function sendValidationEmail(contact) {
  return sendAccountDecisionEmail(contact, true);
}

async function sendRefusalEmail(contact) {
  return sendAccountDecisionEmail(contact, false);
}

// Email pour le code de vérification
async function sendOtpEmail(email, code, role) {
  const html = `
    <p>Bonjour,</p>
    <p>Vous avez demandé la création d'un compte <strong>${role}</strong> sur la plateforme RenalCare.</p>
    <p>Voici votre code de vérification :</p>
    <h2 style="letter-spacing: 4px;">${code}</h2>
    <p>Ce code est valable pendant 10 minutes.</p>
    <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.</p>
    <p>Cordialement,<br>L'équipe RenalCare</p>
  `;

  const mailOptions = {
    from: `"RenalCare" <${process.env.MAIL_USER}>`,
    to: email,
    subject: 'Votre code de vérification RenalCare',
    html,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = {
  sendContactNotification,
  sendValidationEmail,
  sendRefusalEmail,
  sendOtpEmail,
};