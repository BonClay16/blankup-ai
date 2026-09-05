// frontend/js/social-config.js
// Social login configuration. External file (not inline) so the
// Content-Security-Policy (script-src 'self') allows it to run.
// Google: OAuth 2.0 Client ID from https://console.cloud.google.com/apis/credentials
// - Add "http://localhost:3000" to Authorized JavaScript origins
// - Must match GOOGLE_CLIENT_ID in backend/.env
// NOTE: Client IDs are public identifiers, NOT secrets. Never put
// GOOGLE_CLIENT_SECRET or any API secret in frontend files.
window.BLANKUP_SOCIAL = {
  googleClientId: '116646431316-5kkndeufqeikrqer21492rkm0k6bi4ih.apps.googleusercontent.com',
  facebookAppId: '',
};
