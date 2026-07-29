// backend/services/mailer.js
/**
 * Blankup Mailer — thin wrapper around nodemailer.
 *
 * If SMTP_HOST/SMTP_USER/SMTP_PASS are set, emails are sent for real.
 * Otherwise (local dev, or a server that hasn't been configured yet),
 * the email is printed to the console instead of failing — this keeps
 * flows like "forgot password" testable without a mail provider, while
 * still making it obvious in the logs that nothing was actually delivered.
 */

const nodemailer = require('nodemailer');

let transporter = null;
let loggedMissingConfigWarning = false;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

/**
 * Sends an email. Never throws — logs the error and returns
 * { sent: false } instead, so a mail outage never crashes a request.
 */
async function sendMail({ to, subject, html, text }) {
  if (!isConfigured()) {
    if (!loggedMissingConfigWarning) {
      console.warn('[Mailer] ⚠️  SMTP_HOST/SMTP_USER/SMTP_PASS not set — emails will be logged to the console instead of delivered.');
      console.warn('[Mailer] ⚠️  Set these in backend/.env before deploying to production (see .env.example).');
      loggedMissingConfigWarning = true;
    }
    console.log('\n──────── [Mailer] Email NOT sent (SMTP not configured) ────────');
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text || html);
    console.log('─────────────────────────────────────────────────────────────\n');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || `"Blankup" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text,
    });
    return { sent: true };
  } catch (err) {
    console.error('[Mailer] Failed to send email:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendMail, isConfigured };