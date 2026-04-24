/**
 * Email-registration content type API id for CMA.
 * Prefer `CONTENTFUL_EMAIL_REGISTRATION_CONTENT_TYPE_ID` on the webhook; `VITE_*` is accepted
 * so the same name as bee-app works if someone copies it to this Vercel project by mistake.
 */
export function getEmailRegistrationContentTypeId(): string {
  return (
    process.env.CONTENTFUL_EMAIL_REGISTRATION_CONTENT_TYPE_ID?.trim() ||
    process.env.VITE_CONTENTFUL_EMAIL_REGISTRATION_CONTENT_TYPE_ID?.trim() ||
    'emailRegistration'
  );
}
