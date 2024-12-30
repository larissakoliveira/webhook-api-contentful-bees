import { EmailRegistration, productNameLanguage } from '../types/types';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import emailTemplates from '../locales/emailTemplates.json';

dotenv.config();

export async function fetchEmailRegistrations(productId: string): Promise<EmailRegistration[]> {
  const spaceId = process.env.VERCEL_CONTENTFUL_SPACE_ID;
  const accessToken = process.env.VERCEL_CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API;

  try {
    const response = await fetch(
      `https://api.contentful.com/spaces/${spaceId}/environments/master/entries?content_type=emailRegistration&fields.relatedProduct.sys.id=${productId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error fetching email registrations: ${response.statusText}`);
    }

    const data = await response.json();

    return data.items.map((item: any) => ({
      email: item.fields.email['en-US'],
      relatedProduct: item.fields.relatedProduct['en-US'],
      entryId: item.sys.id,
      language: item.fields.language?.['en-US'] || 'nl'
    }));
  } catch (error) {
    console.error('Error fetching email registrations:', error);
    throw error;
  }
}

export async function sendNotificationEmails(emailRegistrations: EmailRegistration[], productNames: productNameLanguage) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const emailPromises = emailRegistrations.map(async (registration) => {
    try {
      const template = emailTemplates[registration.language] || emailTemplates.nl;
      const productName = productNames[registration.language as keyof productNameLanguage] || productNames.nl;

      await transporter.sendMail({
        from: `"Jeroen-Bee-Company" <${process.env.EMAIL_USER}>`,
        to: registration.email,
        subject: `${productName} ${template.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #f9f9f9;">
            <h2 style="color: #652911; text-align: center;">🎉 ${productName} ${template.subject} 🎉</h2>
            <div style="text-align: center;">
              <img src="cid:beeImage" alt="Happy Bee" style="max-width: 150px; margin: 10px auto;" />
            </div>
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
        attachments: [
          {
            filename: 'bee.gif',
            path: path.join(__dirname, '../assets/bee.gif'),
            cid: 'beeImage',
          },
        ],
      });

      await deleteEmailRegistration(registration.entryId);

    } catch (error) {
      console.error(`Failed to send email to ${registration.email}:`, error);
    }
  });

  await Promise.all(emailPromises);
}

export async function deleteEmailRegistration(entryId: string) {
  const spaceId = process.env.VERCEL_CONTENTFUL_SPACE_ID;
  const accessToken = process.env.VERCEL_CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API;

  try {
    const response = await fetch(
      `https://api.contentful.com/spaces/${spaceId}/environments/master/entries/${entryId}`,
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
