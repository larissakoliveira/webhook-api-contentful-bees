import { EmailRegistration, productNameLanguage } from '../types/types';
import { getEmailRegistrationContentTypeId } from './emailRegistrationEnv';
import { firstLocale } from './contentfulWebhookFields';
import fs from 'fs';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import emailTemplates from '../locales/emailTemplates.json';

dotenv.config();

/** Contentful environment id (`master`, `staging`, …). Default `master`. */
function contentfulEnvironmentId(): string {
  return process.env.CONTENTFUL_ENVIRONMENT_ID?.trim() || 'master';
}

/** Must match Content model → Email registration → API identifier (default `emailRegistration`). */
function emailRegistrationContentTypeId(): string {
  return getEmailRegistrationContentTypeId();
}

/** Must match the Reference field API ID only — e.g. `relatedProduct`, not `relatedProduct.en-US`. */
function relatedProductFieldId(): string {
  const raw = process.env.CONTENTFUL_EMAIL_RELATED_PRODUCT_FIELD_ID?.trim() || 'relatedProduct';
  const base = raw.split('.')[0];
  if (raw.includes('.')) {
    console.warn(
      '[fetchEmailRegistrations] CONTENTFUL_EMAIL_RELATED_PRODUCT_FIELD_ID should be the field id only (no locale suffix). Using:',
      base
    );
  }
  return base;
}

/**
 * How many entries (any content type) reference this product via CMA `links_to_entry`.
 * Used when the webhook finds 0 signups — if count > 0 but types omit the expected email type, env `CONTENTFUL_EMAIL_REGISTRATION_CONTENT_TYPE_ID` is wrong.
 */
export async function countEntriesLinkingToProduct(productId: string): Promise<{
  ok: boolean;
  count: number;
  contentTypeIds: string[];
  status?: number;
}> {
  const spaceId = process.env.CONTENTFUL_SPACE_ID?.trim();
  const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API?.trim();
  if (!spaceId || !accessToken) {
    return { ok: false, count: 0, contentTypeIds: [] };
  }
  const envId = contentfulEnvironmentId();
  const base = `https://api.contentful.com/spaces/${spaceId}/environments/${encodeURIComponent(envId)}/entries`;
  const query = `links_to_entry=${encodeURIComponent(productId)}&limit=100`;
  try {
    const res = await fetch(`${base}?${query}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      return { ok: false, count: 0, contentTypeIds: [], status: res.status };
    }
    const data = (await res.json()) as {
      items?: { sys?: { contentType?: { sys?: { id?: string } } } }[];
    };
    const items = data.items ?? [];
    const contentTypeIds = [...new Set(items.map((i) => i.sys?.contentType?.sys?.id).filter(Boolean))] as string[];
    return { ok: true, count: items.length, contentTypeIds };
  } catch {
    return { ok: false, count: 0, contentTypeIds: [] };
  }
}

export async function fetchEmailRegistrations(productId: string): Promise<EmailRegistration[]> {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API;
  const ct = emailRegistrationContentTypeId();
  const refField = relatedProductFieldId();

  if (!spaceId?.trim() || !accessToken?.trim()) {
    throw new Error('Missing CONTENTFUL_SPACE_ID or CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API in .env');
  }

  const envId = contentfulEnvironmentId();
  const base = `https://api.contentful.com/spaces/${spaceId}/environments/${encodeURIComponent(envId)}/entries`;
  /** Standard CMA relational query (preferred). */
  const byReference = `content_type=${encodeURIComponent(ct)}&fields.${refField}.sys.id=${encodeURIComponent(productId)}`;
  /** Incoming links (do not combine with `content_type`). */
  const byIncomingLink = `sys.contentType.sys.id=${encodeURIComponent(ct)}&links_to_entry=${encodeURIComponent(productId)}`;
  const byLinkOnly = `links_to_entry=${encodeURIComponent(productId)}&limit=100`;

  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    } as const;

    const parseJson = async (res: Response) => {
      const text = await res.text();
      try {
        return JSON.parse(text) as { items?: unknown[] };
      } catch {
        throw new Error(`CMA returned non-JSON (${text.slice(0, 200)})`);
      }
    };

    type CmaListPayload = { items?: unknown[] };

    let lastCmaFailure = '';

    const fetchList = async (query: string, label: string): Promise<CmaListPayload | null> => {
      const res = await fetch(`${base}?${query}`, { headers });
      const bodyPreview = await res.clone().text();
      if (!res.ok) {
        lastCmaFailure = `${label} → HTTP ${res.status}: ${bodyPreview.slice(0, 350)}`;
        console.warn(`[fetchEmailRegistrations] ${label}`, res.status, bodyPreview.slice(0, 400));
        return null;
      }
      const data = (await parseJson(res)) as CmaListPayload;
      console.info(`[fetchEmailRegistrations] ok via ${label}`, { count: data?.items?.length ?? 0 });
      return data;
    };

    let filterByContentType = false;
    let registrationData: CmaListPayload | null = await fetchList(byReference, 'content_type+fields.reference');
    if (!registrationData) {
      registrationData = await fetchList(byIncomingLink, 'sys.contentType+links_to_entry');
    }
    if (!registrationData) {
      registrationData = await fetchList(byLinkOnly, 'links_to_entry only');
      filterByContentType = true;
    }
    if (!registrationData) {
      throw new Error(
        'Contentful CMA: could not list email registrations. Verify Vercel env CONTENTFUL_SPACE_ID, CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API, CONTENTFUL_ENVIRONMENT_ID, CONTENTFUL_EMAIL_REGISTRATION_CONTENT_TYPE_ID. ' +
          (lastCmaFailure ? `Last error: ${lastCmaFailure}` : '')
      );
    }

    // `fields.<ref>.sys.id` can return 200 with 0 items when the Reference field is localized (use locale in path).
    if ((registrationData.items?.length ?? 0) === 0) {
      for (const loc of ['en-US', 'nl', 'nl-NL', 'de-DE', 'pt-BR', 'en'] as const) {
        const byRefLocale = `content_type=${encodeURIComponent(ct)}&fields.${refField}.${encodeURIComponent(loc)}.sys.id=${encodeURIComponent(productId)}`;
        const next = await fetchList(byRefLocale, `content_type+fields.${refField}.${loc}`);
        if (next && (next.items?.length ?? 0) > 0) {
          registrationData = next;
          filterByContentType = false;
          break;
        }
      }
    }
    if ((registrationData.items?.length ?? 0) === 0) {
      const next = await fetchList(byIncomingLink, 'sys.contentType+links_to_entry (after empty primary)');
      if (next && (next.items?.length ?? 0) > 0) {
        registrationData = next;
        filterByContentType = false;
      }
    }
    if ((registrationData.items?.length ?? 0) === 0) {
      const next = await fetchList(byLinkOnly, 'links_to_entry only (after empty primary)');
      if (next && (next.items?.length ?? 0) > 0) {
        registrationData = next;
        filterByContentType = true;
      }
    }

    const payload = registrationData as { items?: unknown[] };
    const rawItems = (payload.items ?? []) as {
      sys?: { id?: string; contentType?: { sys?: { id?: string } } };
      fields?: Record<string, unknown>;
    }[];

    let items = rawItems;

    if (filterByContentType) {
      items = rawItems.filter((item) => item.sys?.contentType?.sys?.id === ct);
      if (rawItems.length > 0 && items.length === 0) {
        const foundIds = [...new Set(rawItems.map((i) => i.sys?.contentType?.sys?.id).filter(Boolean))];
        console.warn(
          '[fetchEmailRegistrations] entries reference this product but none match CONTENTFUL_EMAIL_REGISTRATION_CONTENT_TYPE_ID.',
          { expected: ct, foundContentTypeIds: foundIds },
          'Fix: Content model → your email signup type → copy API identifier into .env as CONTENTFUL_EMAIL_REGISTRATION_CONTENT_TYPE_ID'
        );
      }
    }

    if (items.length === 0) {
      console.info('[fetchEmailRegistrations] 0 entries to notify — create/publish Email registration entries with this product linked, or fix CONTENTFUL_EMAIL_REGISTRATION_CONTENT_TYPE_ID if logs showed unknownContentType.', {
        contentTypeId: ct,
        refField,
        productId,
      });
    }

    return items.map((item: any) => {
      const fields = item.fields ?? {};
      const email = firstLocale(fields.email as Record<string, string> | undefined) as string | undefined;
      const ref = fields[refField] ?? fields.relatedProduct;
      const relatedProduct = firstLocale(ref as Record<string, unknown> | undefined) as EmailRegistration['relatedProduct'];
      const langField = fields.language ?? fields.Language;
      const language = (firstLocale(langField as Record<string, string> | undefined) as string | undefined) || 'nl';
      return {
        email: email ?? '',
        relatedProduct,
        entryId: item.sys?.id ?? '',
        language: language as EmailRegistration['language'],
      };
    });
  } catch (error) {
    console.error('Error fetching email registrations:', error);
    throw error;
  }
}

export type SendNotificationResult = { sent: number; failed: number; skippedEmpty: number };

/** Sends stock notifications. Gmail errors are counted in `failed` (not thrown) so callers can report honestly. */
export async function sendNotificationEmails(
  emailRegistrations: EmailRegistration[],
  productNames: productNameLanguage
): Promise<SendNotificationResult> {
  const beePath = path.join(__dirname, '../assets/bee.gif');
  const beeAttachment = fs.existsSync(beePath)
    ? [{ filename: 'bee.gif', path: beePath, cid: 'beeImage' as const }]
    : [];
  const beeImgHtml = beeAttachment.length
    ? '<div style="text-align: center;"><img src="cid:beeImage" alt="" style="max-width: 150px; margin: 10px auto;" /></div>'
    : '<div style="text-align: center; font-size: 48px;">&#128029;</div>';

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const outcomes = await Promise.all(
    emailRegistrations.map(async (registration): Promise<'sent' | 'failed' | 'skippedEmpty'> => {
      const to = (registration.email ?? '').trim();
      if (!to) {
        console.warn('[sendNotificationEmails] skipping entry with empty email', registration.entryId);
        return 'skippedEmpty';
      }

      try {
        const template = emailTemplates[registration.language] || emailTemplates.nl;
        const productName = productNames[registration.language as keyof productNameLanguage] || productNames.nl;

        const info = await transporter.sendMail({
          from: `"Jeroen-Bee-Company" <${process.env.EMAIL_USER}>`,
          to,
          subject: `${productName} ${template.subject}`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #f9f9f9;">
            <h2 style="color: #652911; text-align: center;">🎉 ${productName} ${template.subject} 🎉</h2>
            ${beeImgHtml}
            <p style="font-size: 16px; color: #333;">${template.greeting}</p>
            <p style="font-size: 16px; color: #333;">${template.message} <strong>"${productName}"</strong> ${template.subject}</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="https://yourwebsite.com/product/${productName}" style="padding: 10px 20px; background-color: #61892F; color: white; text-decoration: none; font-weight: bold; border-radius: 5px;">
                ${template.buttonText}
              </a>
            </div>
            <p style="font-size: 14px; color: #777; text-align: center;">${template.thanks}</p>
          </div>
        `,
          attachments: beeAttachment,
        });

        console.info('[sendNotificationEmails] mail accepted', { to, messageId: info.messageId });

        await deleteEmailRegistration(registration.entryId);
        return 'sent';
      } catch (error) {
        console.error(`[sendNotificationEmails] failed for ${to}:`, error);
        return 'failed';
      }
    })
  );

  const sent = outcomes.filter((o) => o === 'sent').length;
  const failed = outcomes.filter((o) => o === 'failed').length;
  const skippedEmpty = outcomes.filter((o) => o === 'skippedEmpty').length;

  const summary = { sent, failed, skippedEmpty };
  console.info('[sendNotificationEmails] done', summary);
  return summary;
}

export async function deleteEmailRegistration(entryId: string) {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API;

  try {
    const envId = contentfulEnvironmentId();
    const response = await fetch(
      `https://api.contentful.com/spaces/${spaceId}/environments/${encodeURIComponent(envId)}/entries/${entryId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error deleting email registration: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting email registration:', error);
  }
}
