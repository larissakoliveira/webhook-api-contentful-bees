import { fetchEmailRegistrations, sendNotificationEmails } from '../utils/utils';
import { isInStockTrue, localizedString, resolveProductNames } from '../utils/contentfulWebhookFields';
import express, { Request, Response, Application } from 'express';
import { productNameLanguage, WebhookPayload } from '../types/types';
import dotenv from 'dotenv';

dotenv.config();

const app: Application = express();
const PORT = (() => {
  const n = Number(process.env.PORT);
  return Number.isFinite(n) && n > 0 ? n : 3000;
})();

app.use(express.json());

app.post('/webhook', async (req: Request, res: Response) => {
  const payload: WebhookPayload = req.body;

  if (!payload.sys || !payload.fields) {
    console.warn('[webhook] 400 invalid payload (missing sys or fields)');
    return res.status(400).json({ message: 'Invalid webhook payload' });
  }

  const productId = payload.sys.id;

  if (!isInStockTrue(payload.fields.inStock as Record<string, boolean | undefined> | undefined)) {
    console.info('[webhook] 200 not in stock, skip emails', { productId });
    return res.status(200).json({ message: 'Product is not back in stock' });
  }

  const resolved = resolveProductNames(payload.fields);
  if (!productId || !resolved) {
    console.warn('[webhook] 400 missing id or NL/EN names', { productId });
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
    console.info('[webhook] in stock, fetching registrations', { productId, en, nl });
    const emailRegistrations = await fetchEmailRegistrations(productId);
    if (emailRegistrations.length === 0) {
      console.info('[webhook] no emailRegistration entries for this product — nothing to send', { productId });
    } else {
      console.info('[webhook] sending', emailRegistrations.length, 'email(s)');
    }
    const sendResult = await sendNotificationEmails(emailRegistrations, productNames);
    return res.status(200).json({
      message:
        emailRegistrations.length === 0
          ? 'No notify-me signups for this product'
          : sendResult.sent > 0
            ? 'Notification email(s) handed off to mail server'
            : 'No emails delivered (check Gmail credentials / logs; see sent, failed)',
      queued: emailRegistrations.length,
      ...sendResult,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error processing webhook:', msg, error);
    return res.status(500).json({ message: 'Error processing webhook', detail: msg });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
