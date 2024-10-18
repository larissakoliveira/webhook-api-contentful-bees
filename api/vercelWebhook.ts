import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchEmailRegistrations, sendNotificationEmails } from '../utils/utils';
import { WebhookPayload } from '../utils/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const payload: WebhookPayload = req.body;

  if (!payload.sys || !payload.fields) {
    return res.status(400).json({ message: 'Invalid webhook payload' });
  }

  if (payload.fields.inStock['en-US'] !== true) {
    return res.status(200).json({ message: 'Product is not back in stock' });
  }

  try {
    const productId = payload.sys.id;
    const productNameDutch = payload.fields.productNameDutch?.['en-US'];
    const emailRegistrations = await fetchEmailRegistrations(productId);
    await sendNotificationEmails(emailRegistrations, productNameDutch);
    return res.status(200).json({ message: 'Emails sent successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ message: 'Error processing webhook' });
  }
}
