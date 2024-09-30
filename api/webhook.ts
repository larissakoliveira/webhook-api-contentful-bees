import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).send({ message: 'Only POST requests allowed' });
  }

  // Extract data from the webhook payload
  const { sys, fields } = req.body;

  if (!sys || !fields) {
    return res.status(400).send({ message: 'Invalid webhook payload' });
  }

  if (fields.inStock['en-US'] !== true) {
    return res.status(200).send({ message: 'Product is not back in stock' });
  }

  try {
    const productId = sys.id;
    const emailRegistrations = await fetchEmailRegistrations(productId);

    await sendNotificationEmails(emailRegistrations, fields.name['en-US']);

    res.status(200).send({ message: 'Emails sent successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send({ message: 'Error processing webhook' });
  }
};

async function fetchEmailRegistrations(productId: string) {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN_GET;

  const response = await fetch(`https://cdn.contentful.com/spaces/${spaceId}/entries?content_type=emailRegistration&fields.productRelated.sys.id=${productId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  return data.items.map((item: any) => ({ email: item.fields.email }));
}

async function sendNotificationEmails(emailRegistrations: { email: string }[], productName: string) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const emailPromises = emailRegistrations.map((registration) =>
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: registration.email,
      subject: `${productName} is Back in Stock!`,
      text: `Hello! The product "${productName}" is now back in stock. Check it out on our website!`,
    })
  );

  await Promise.all(emailPromises);
}
