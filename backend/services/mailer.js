// backend/services/mailer.js
/**
 * Blankup Mailer — thin wrapper around nodemailer.
 *
 * Production: requires SMTP_HOST/SMTP_USER/SMTP_PASS. Fails with clear error if not configured.
 * Development: falls back to console logging for testability without a mail provider.
 */

const nodemailer = require('nodemailer');

let transporter = null;
let loggedMissingConfigWarning = false;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
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
 * Sends an email.
 *
 * Production: throws if SMTP not configured (fail-closed).
 * Development: logs to console if SMTP not configured (for testability).
 *
 * Returns { sent: true } on success, { sent: false, reason } on failure.
 */
async function sendMail({ to, subject, html, text }) {
  if (!isConfigured()) {
    if (isProduction()) {
      // Production: fail-closed — do not send fake success
      console.error('[Mailer] CRITICAL: SMTP_HOST/SMTP_USER/SMTP_PASS not set in production!');
      throw new Error('Email service not configured. Cannot send email in production.');
    }

    // Development/test: log to console for testability
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
