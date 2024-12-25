import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchEmailRegistrations, sendNotificationEmails } from '../utils/utils';
import { WebhookPayload } from '../types/types';
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

  if (payload.fields.inStock['en-US'] !== true) {
    logger.info('Product is not back in stock', { productId: payload.sys.id });
    return res.status(200).json({ message: 'Product is not back in stock' });
  }

  try {
    const productId = payload.sys.id;
    const productNameDutch = payload.fields.productNameDutch?.['en-US'];
    
    logger.info('Fetching email registrations', { productId });
    const emailRegistrations = await fetchEmailRegistrations(productId);
    
    logger.info('Sending notification emails', { 
      productId,
      emailCount: emailRegistrations.length 
    });
    await sendNotificationEmails(emailRegistrations, productNameDutch);
    
    logger.info('Emails sent successfully', {
      productId,
      emailCount: emailRegistrations.length
    });
    return res.status(200).json({ message: 'Emails sent successfully' });
  } catch (error) {
    logger.error('Error processing webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({ message: 'Error processing webhook' });
  }
}
