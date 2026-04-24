import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getEmailRegistrationContentTypeId } from '../utils/emailRegistrationEnv';
import { countEntriesLinkingToProduct, fetchEmailRegistrations, sendNotificationEmails } from '../utils/utils';
import { isInStockTrue, localizedString, resolveProductNames } from '../utils/contentfulWebhookFields';
import { WebhookPayload, productNameLanguage } from '../types/types';
import logger from '../utils/logger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  logger.info('Received webhook request', { method: req.method });

  if (req.method !== 'POST') {
    logger.warn('Invalid request method', { method: req.method });
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const payload: WebhookPayload = req.body;

  if (!payload.sys || !payload.fields) {
    logger.error('Invalid webhook payload received', { payload });
    return res.status(400).json({ message: 'Invalid webhook payload' });
  }

  if (!isInStockTrue(payload.fields.inStock as Record<string, boolean | undefined> | undefined)) {
    logger.info('Product is not back in stock', { productId: payload.sys.id });
    return res.status(200).json({ message: 'Product is not back in stock' });
  }

  const resolved = resolveProductNames(payload.fields);
  if (!payload.sys.id || !resolved) {
    logger.error('Product ID or Dutch/English names are missing', { payload });
    return res.status(400).json({ message: 'Product ID or Dutch/English names are missing' });
  }

  const { en, nl } = resolved;
  const productNames: productNameLanguage = {
    en,
    nl,
    pt: localizedString(payload.fields.productNamePortuguese as Record<string, unknown> | undefined) || en,
    de: localizedString(payload.fields.productNameGerman as Record<string, unknown> | undefined) || en,
  };

  try {
    const productId = payload.sys.id;
    
    logger.info('Fetching email registrations', { productId });
    const emailRegistrations = await fetchEmailRegistrations(productId);

    const linkProbe =
      emailRegistrations.length === 0 ? await countEntriesLinkingToProduct(productId) : null;

    if (emailRegistrations.length === 0) {
      logger.info('No email registrations linked to this product; nothing to send', {
        productId,
        linkProbe,
        contentTypeIdUsed: getEmailRegistrationContentTypeId(),
      });
    }

    logger.info('Sending notification emails', {
      productId,
      emailCount: emailRegistrations.length
    });
    const sendResult = await sendNotificationEmails(emailRegistrations, productNames);

    logger.info('Notification send finished', { productId, ...sendResult });

    return res.status(200).json({
      productId,
      message:
        emailRegistrations.length === 0
          ? 'No notify-me signups for this product'
          : sendResult.sent > 0
            ? 'Notification email(s) handed off to mail server'
            : 'No emails delivered (check Gmail credentials / logs; see sent, failed)',
      queued: emailRegistrations.length,
      ...sendResult,
      ...(emailRegistrations.length === 0
        ? {
            hint:
              'Signups are per product entry. In Contentful, open an Email registration entry and confirm its product reference points to this productId. On Vercel, bee-app and this webhook must share the same CONTENTFUL_SPACE_ID and environment (master vs staging), and the email-registration content type id must match (bee-app: VITE_CONTENTFUL_*; webhook: CONTENTFUL_EMAIL_REGISTRATION_CONTENT_TYPE_ID or VITE_CONTENTFUL_EMAIL_REGISTRATION_CONTENT_TYPE_ID).',
            diagnostic: {
              webhookContentTypeId: getEmailRegistrationContentTypeId(),
              webhookEnvironment: process.env.CONTENTFUL_ENVIRONMENT_ID?.trim() || 'master',
              webhookRelatedProductField:
                (process.env.CONTENTFUL_EMAIL_RELATED_PRODUCT_FIELD_ID || 'relatedProduct').split('.')[0],
              spaceIdPrefix: (process.env.CONTENTFUL_SPACE_ID || '').slice(0, 8) || 'missing',
              cmaEntriesLinkingToThisProductAnyType: linkProbe?.ok ? linkProbe.count : null,
              contentTypesAmongThose: linkProbe?.ok ? linkProbe.contentTypeIds : [],
              cmaLinkProbeHttpStatus: linkProbe && !linkProbe.ok ? linkProbe.status ?? 'error' : undefined,
              explain:
                linkProbe?.ok &&
                linkProbe.count > 0 &&
                !linkProbe.contentTypeIds.includes(getEmailRegistrationContentTypeId())
                  ? 'Entries link to this product but none match the configured email-registration content type id — set CONTENTFUL_EMAIL_REGISTRATION_CONTENT_TYPE_ID (or VITE_CONTENTFUL_EMAIL_REGISTRATION_CONTENT_TYPE_ID) to your model API id (e.g. eMailRegistration) on this webhook project and redeploy.'
                  : linkProbe?.ok && linkProbe.count === 0
                    ? 'CMA found no entries linking to this product id — the Related product reference on your signup entry may be empty, wrong product, or wrong space/environment on the webhook.'
                    : undefined,
            },
          }
        : {}),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error('Error processing webhook', {
      error: detail,
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      message: 'Error processing webhook',
      detail: detail.slice(0, 800),
    });
  }
}