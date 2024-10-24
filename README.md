# Backend for Bee Product Notification App

This backend handles webhook events and sends notification emails when a product is back in stock. It is designed to work with **Contentful** for product management and uses **Nodemailer** for sending emails. The backend runs on **Express.js** for local development and uses **Vercel's serverless functions** in the production environment.

## Features

- Webhook handler for product stock status changes.
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
   npm start
