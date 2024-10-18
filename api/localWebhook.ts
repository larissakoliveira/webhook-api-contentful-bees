import { fetchEmailRegistrations, sendNotificationEmails } from '../utils/utils';
import express, { Request, Response, Application } from 'express';
import { WebhookPayload } from '../utils/types';
import dotenv from 'dotenv';

dotenv.config();

const app: Application = express();
const PORT = 3000;

app.use(express.json());

app.post('/webhook', async (req: Request, res: Response) => {
  const payload: WebhookPayload = req.body;

  if (!payload.sys || !payload.fields) {
    return res.status(400).json({ message: 'Invalid webhook payload' });
  }

  const inStock = payload.fields.inStock?.['en-US'];
  if (inStock !== true) {
    return res.status(200).json({ message: 'Product is not back in stock' });
  }

  const productId = payload.sys.id;
  const productNameDutch = payload.fields.productNameDutch?.['en-US'];

  if (!productId || !productNameDutch) {
    return res.status(400).json({ message: 'Product ID or name is missing' });
  }

  try {
    const emailRegistrations = await fetchEmailRegistrations(productId);
    await sendNotificationEmails(emailRegistrations, productNameDutch);
    return res.status(200).json({ message: 'Emails sent successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ message: 'Error processing webhook' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});