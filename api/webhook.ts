import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

dotenv.config();

// Ensure all necessary environment variables are set
const requiredEnvVars = ['CONTENTFUL_SPACE_ID', 'VERCEL_CONTENTFUL_TOKEN_MANAGEMENT_API', 'EMAIL_USER', 'EMAIL_PASS'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Missing environment variable: ${varName}`);
    process.exit(1);
  }
});

// Define the EmailRegistration interface
interface EmailRegistration {
  email: string;
  relatedProduct: {
    sys: {
      type: string;
      linkType: string;
      id: string;
    };
  };
  entryId: string;
}

// Define the WebhookPayload type
type WebhookPayload = {
  metadata: {
    tags: any[];
    concepts: any[];
  };
  fields: {
    name: {
      'en-US': string;
    };
    image: {
      'en-US': {
        sys: {
          type: string;
          linkType: string;
          id: string;
        };
      };
    };
    description: {
      'en-US': {
        data: Record<string, unknown>;
        content: Array<{
          data: Record<string, unknown>;
          content: Array<{
            data: Record<string, unknown>;
            marks: any[];
            value: string;
            nodeType: string;
          }>;
          nodeType: string;
        }>;
      };
    };
    inStock: {
      'en-US': boolean;
    };
  };
  sys: {
    type: string;
    id: string;
    space: {
      sys: {
        type: string;
        linkType: string;
        id: string;
      };
    };
    environment: {
      sys: {
        id: string;
        type: string;
        linkType: string;
      };
    };
    contentType: {
      sys: {
        type: string;
        linkType: string;
        id: string;
      };
    };
    createdBy: {
      sys: {
        type: string;
        linkType: string;
        id: string;
      };
    };
    updatedBy: {
      sys: {
        type: string;
        linkType: string;
        id: string;
      };
    };
    revision: number;
    createdAt: string;
    updatedAt: string;
  };
};

// Main handler function
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Directly access the request body, as Vercel parses it for you
  const payload: WebhookPayload = req.body;

  // Check for valid payload
  if (!payload.sys || !payload.fields) {
    return res.status(400).json({ message: 'Invalid webhook payload' });
  }

  if (payload.fields.inStock['en-US'] !== true) {
    return res.status(200).json({ message: 'Product is not back in stock' });
  }

  try {
    const productId = payload.sys.id;
    const emailRegistrations = await fetchEmailRegistrations(productId);
    await sendNotificationEmails(emailRegistrations, payload.fields.name['en-US']);
    return res.status(200).json({ message: 'Emails sent successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ message: 'Error processing webhook' });
  }
}

async function fetchEmailRegistrations(productId: string): Promise<EmailRegistration[]> {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.VERCEL_CONTENTFUL_TOKEN_MANAGEMENT_API;

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

// Function to delete an email registration
async function deleteEmailRegistration(entryId: string) {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.VERCEL_CONTENTFUL_TOKEN_MANAGEMENT_API;

  try {
    const response = await fetch(`https://api.contentful.com/spaces/${spaceId}/environments/master/entries/${entryId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error deleting email registration: ${response.statusText}`);
    }

  } catch (error) {
    console.error('Error deleting email registration:', error);
  }
}

// Function to send notification emails
async function sendNotificationEmails(emailRegistrations: EmailRegistration[], productName: string) {
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
  subject: `${productName} is Back in Stock!`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #f9f9f9;">
      <h2 style="color: #652911; text-align: center;">🎉 ${productName} is Back in Stock! 🎉</h2>
      <div style="text-align: center;">
        <img src="cid:beeImage" alt="Happy Bee" style="max-width: 150px; margin: 10px auto;" />
      </div>
      <p style="font-size: 16px; color: #333;">Hello!</p>
      <p style="font-size: 16px; color: #333;">We’re buzzing with excitement to let you know that the product <strong>"${productName}"</strong> is now back in stock. Don't miss the chance to grab it!</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="https://yourwebsite.com/product/${productName}" style="padding: 10px 20px; background-color: #61892F; color: white; text-decoration: none; font-weight: bold; border-radius: 5px;">
          Check it out!
        </a>
      </div>
      <p style="font-size: 14px; color: #777; text-align: center;">Thank you for shopping with us!</p>
    </div>
  `,
  attachments: [
    {
      filename: 'bee.gif',
      path: '../assets/bee.gif',
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
