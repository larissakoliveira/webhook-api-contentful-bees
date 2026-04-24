import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createEmailRegistrationViaCma } from '../utils/createEmailRegistrationCma';
import logger from '../utils/logger';

function headerValue(h: string | string[] | undefined): string | undefined {
  if (h === undefined) return undefined;
  return Array.isArray(h) ? h[0] : h;
}

function setCors(res: VercelResponse, req: VercelRequest): void {
  const configured = process.env.EMAIL_REGISTER_CORS_ORIGIN?.trim();
  const origin = headerValue(req.headers.origin) ?? '';

  if (!configured || configured === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    const allowed = configured.split(',').map((s) => s.trim()).filter(Boolean);
    if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      // No Origin (e.g. curl): still allow the API for tooling.
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    // Cross-origin browser request with Origin not in allowlist: omit header → browser blocks reading the response.
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Bee-Register-Secret');
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(res, req);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  const secret = process.env.EMAIL_REGISTER_SHARED_SECRET?.trim();
  if (secret) {
    const got = headerValue(req.headers['x-bee-register-secret']);
    if (got !== secret) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  const language = typeof body.language === 'string' ? body.language.trim() : 'nl';

  if (!email || !productId) {
    res.status(400).json({ message: 'Missing email or productId' });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: 'Invalid email' });
    return;
  }

  try {
    const result = await createEmailRegistrationViaCma({ email, productId, language });
    if (!result.ok) {
      logger.warn('[registerEmail] CMA rejected', { status: result.status, preview: result.body.slice(0, 200) });
      const status = result.status >= 400 && result.status < 600 ? result.status : 502;
      res.status(status).json({
        message: 'Contentful rejected registration',
        detail: result.body.slice(0, 500),
      });
      return;
    }
    logger.info('[registerEmail] created entry', { productId, email: `${email.slice(0, 3)}…` });
    res.status(201).json({ message: 'Registered' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[registerEmail] unexpected error', { error: msg });
    res.status(500).json({ message: 'Server error', detail: msg.slice(0, 400) });
  }
}
