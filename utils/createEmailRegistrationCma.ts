/**
 * Creates an Email registration entry via Contentful CMA (server-side only).
 * Mirrors bee-app field shape so the webhook can reuse the same Contentful model.
 */

import { getEmailRegistrationContentTypeId } from './emailRegistrationEnv';

export type RegisterEmailParams = {
  email: string;
  productId: string;
  language: string;
};

export type RegisterEmailResult =
  | { ok: true }
  | { ok: false; status: number; body: string };

function contentfulEnvironmentId(): string {
  return process.env.CONTENTFUL_ENVIRONMENT_ID?.trim() || 'master';
}

function emailFieldId(): string {
  return process.env.CONTENTFUL_EMAIL_REGISTRATION_EMAIL_FIELD_ID?.trim() || 'email';
}

function languageFieldId(): string {
  return process.env.CONTENTFUL_EMAIL_REGISTRATION_LANGUAGE_FIELD_ID?.trim() || 'language';
}

function relatedProductFieldId(): string {
  const raw = process.env.CONTENTFUL_EMAIL_RELATED_PRODUCT_FIELD_ID?.trim() || 'relatedProduct';
  return raw.split('.')[0] ?? 'relatedProduct';
}

function registrationLocale(): string {
  return process.env.CONTENTFUL_EMAIL_REGISTRATION_LOCALE?.trim() || 'en-US';
}

export async function createEmailRegistrationViaCma(params: RegisterEmailParams): Promise<RegisterEmailResult> {
  const spaceId = process.env.CONTENTFUL_SPACE_ID?.trim();
  const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API?.trim();

  if (!spaceId || !accessToken) {
    return { ok: false, status: 500, body: 'Missing CONTENTFUL_SPACE_ID or CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API' };
  }

  const envId = contentfulEnvironmentId();
  const ct = getEmailRegistrationContentTypeId();
  const locale = registrationLocale();
  const emailField = emailFieldId();
  const languageField = languageFieldId();
  const refField = relatedProductFieldId();

  const url = `https://api.contentful.com/spaces/${spaceId}/environments/${encodeURIComponent(envId)}/entries`;

  const fields: Record<string, Record<string, unknown>> = {
    [emailField]: { [locale]: params.email },
    [languageField]: { [locale]: params.language },
    [refField]: {
      [locale]: {
        sys: {
          type: 'Link',
          linkType: 'Entry',
          id: params.productId,
        },
      },
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.contentful.management.v1+json',
      'X-Contentful-Content-Type': ct,
    },
    body: JSON.stringify({ fields }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, body: bodyText };
  }
  return { ok: true };
}
