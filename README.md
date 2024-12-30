# Backend for Bee Product Notification App

This backend handles webhook events and sends notification emails when a product is back in stock. It is designed to work with **Contentful** for product management and uses **Nodemailer** for sending emails. The backend runs on **Express.js** for local development and uses **Vercel's serverless functions** in the production environment. [Frontend for this application](https://github.com/devFullMates/bee-app)

## Features

- Webhook handler for product stock status changes. (https://webhook-api-contentful-bees.vercel.app/api/vercelWebhook) Contentful
- Sends notification emails when a product is back in stock.
- Local development uses Express.js.
- Production uses Vercel serverless functions.
- Integration with Contentful for product management.

## Tech Stack

- **Node.js** with **Express.js** (for local development)
- **Vercel serverless functions** (for production deployment)
- **Nodemailer** for sending emails
- **Contentful** as a CMS for product management
- **Ngrok** to expose your local development server to the internet to test the webhook locally
- **Jest** for application tests
- **Winston** for logging errors

## Getting Started

### Prerequisites

- Node.js installed locally
- Contentful account and API tokens
- Email account for sending notifications (used by Nodemailer)

### Installation
1. Clone this repository:
   ```bash
   git clone git@github.com:larissakoliveira/bee-app.git
2. Add a `.env` file with the following variables:
   
| Variable Name                                      | Description                                                 |
|----------------------------------------------------|-------------------------------------------------------------|
| `EMAIL_USER`                                       | The email address used to send notifications                 |
| `EMAIL_PASS`                                       | The password for the email account used to send notifications|
| `VERCEL_CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API`     | Contentful management API token for Vercel deployment        |
| `CONTENTFUL_SPACE_ID`                              | The Contentful space ID for accessing the CMS                |
| `CONTENTFUL_ACCESS_TOKEN_MANAGEMENT_API`           | Contentful management API token for local development        |

   ```bash
   git clone https://github.com/your-username/honey-products-store-backend.git
   npm install
   npm run dev
```

To run locally, after running with `npm run dev`, use this command: `ngrok http 3000`, and copy its forwarding URL into the Contentful webhook settings by replacing the Vercel URL (e.g., [https://webhook-api-contentful-bees.vercel.app/api/vercelWebhook]) with your ngrok URL generated for local development (e.g., `https://<forwarding-ngrok-url>/webhook`).

## Testing

The project uses Jest for testing. The following test commands are available:

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```
Test files are located in the `tests` directory and follow the naming convention `*.test.ts`.

## Logging

The application uses Winston for logging. Logs are stored in the `logs` directory:

- `logs/error.log`: Contains error-level logs
- `logs/combined.log`: Contains all logs

In development mode, logs are also output to the console.

Log levels used:
- `error`: For application errors
- `warn`: For warning conditions
- `info`: For general application information
