import { fetchEmailRegistrations, sendNotificationEmails } from '../utils/utils';
import { createEmailRegistrationViaCma } from '../utils/createEmailRegistrationCma';
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

function setRegisterEmailCors(res: Response): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Bee-Register-Secret');
}

app.options('/register-email', (_req: Request, res: Response) => {
  setRegisterEmailCors(res);
  res.status(204).end();
});

app.post('/register-email', async (req: Request, res: Response) => {
  setRegisterEmailCors(res);
  const secret = process.env.EMAIL_REGISTER_SHARED_SECRET?.trim();
  const secretHeader = req.headers['x-bee-register-secret'];
  const secretValue = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;
  if (secret && secretValue !== secret) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const body = req.body as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  const language = typeof body.language === 'string' ? body.language.trim() : 'nl';
  if (!email || !productId) {
    return res.status(400).json({ message: 'Missing email or productId' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Invalid email' });
  }
  try {
    const result = await createEmailRegistrationViaCma({ email, productId, language });
    if (!result.ok) {
      const status = result.status >= 400 && result.status < 600 ? result.status : 502;
      return res.status(status).json({
        message: 'Contentful rejected registration',
        detail: result.body.slice(0, 500),
      });
    }
    return res.status(201).json({ message: 'Registered' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[register-email]', msg);
    return res.status(500).json({ message: 'Server error', detail: msg.slice(0, 400) });
  }
});

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
