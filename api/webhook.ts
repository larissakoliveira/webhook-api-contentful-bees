import express, { Request, Response, Application } from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const requiredEnvVars = ['CONTENTFUL_SPACE_ID', 'CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API', 'EMAIL_USER', 'EMAIL_PASS'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Missing environment variable: ${varName}`);
    process.exit(1);
  }
});

const app: Application = express();
const PORT = 3000;

// Middleware to parse JSON and handle CORS
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

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

app.post('/webhook', async (req: Request, res: Response) => {
  if (!req.body) {
    console.error('Invalid payload: Missing req.body');
    return res.status(400).json({ message: 'Invalid webhook payload FIRST HERE' });
  }

  const { sys, fields }: WebhookPayload = req.body;

  if (!sys || !fields) {
    return res.status(400).json({ message: 'Invalid webhook payload second HERE' });
  }

  if (fields.inStock['en-US'] !== true) {
    return res.status(200).json({ message: 'Product is not back in stock' });
  }

  try {
    const productId = sys.id;
    const emailRegistrations = await fetchEmailRegistrations(productId);

    await sendNotificationEmails(emailRegistrations, fields.name['en-US']);

    return res.status(200).json({ message: 'Emails sent successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ message: 'Error processing webhook' });
  }
});

async function fetchEmailRegistrations(productId: string): Promise<EmailRegistration[]> {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API;

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

async function deleteEmailRegistration(entryId: string) {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API;

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
