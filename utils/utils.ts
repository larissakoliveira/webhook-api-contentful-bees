import { EmailRegistration } from '../types/types'
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export async function fetchEmailRegistrations(productId: string): Promise<EmailRegistration[]> {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
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
    }));
  } catch (error) {
    console.error('Error fetching email registrations:', error);
    throw error;
  }
}

export async function sendNotificationEmails(emailRegistrations: EmailRegistration[], productName: string) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  
    const emailPromises = emailRegistrations.map(async (registration) => {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: registration.email,
          subject: `${productName} is Terug op Voorraad!`,
          html: `
       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #f9f9f9;">
        <h2 style="color: #652911; text-align: center;">🎉 ${productName} is Terug op Voorraad! 🎉</h2>
        <div style="text-align: center;">
          <img src="cid:beeImage" alt="Gelukkige Bij" style="max-width: 150px; margin: 10px auto;" />
        </div>
        <p style="font-size: 16px; color: #333;">Hallo!</p>
        <p style="font-size: 16px; color: #333;">We zijn enthousiast om je te laten weten dat het product <strong>"${productName}"</strong> nu terug op voorraad is. Mis deze kans niet!</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="https://yourwebsite.com/product/${productName}" style="padding: 10px 20px; background-color: #61892F; color: white; text-decoration: none; font-weight: bold; border-radius: 5px;">
            Bekijk het!
          </a>
        </div>
        <p style="font-size: 14px; color: #777; text-align: center;">Bedankt voor uw aankoop!</p>
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
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
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
