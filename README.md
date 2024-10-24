# Honey Products Store - Backend

## Overview
This backend is part of the Honey Products Store application, which showcases various honey-based products such as honey jars, lip balms, and other items. While the frontend allows users to browse products and sign up for notifications when items are back in stock, the backend handles the real-time notifications and email delivery system when products are restocked. The application uses Contentful CMS to manage product data and WebSockets to enable real-time communication between the server and the client.

## Features
- **Real-Time Notifications**: WebSocket implementation to notify users instantly when a product is back in stock.
- **Email Notifications**: Automatically sends email notifications to users when a product they signed up for is restocked using **Nodemailer**.
- **Webhook Integration**: A webhook is used to detect changes in the product's stock status within Contentful, triggering the notification process.

## Tech Stack
- **Node.js**: The backend is built using Node.js to handle server-side logic.
- **Express.js**: For setting up the server, handling HTTP requests, and serving WebSocket connections.
- **WebSockets**: For real-time communication, notifying users when product stock updates occur.
- **Nodemailer**: For sending email notifications to users who have subscribed to be notified about restocked products.
- **Contentful Webhook**: Triggers notifications when the stock status changes on the Contentful CMS.

## How It Works
1. **Contentful Webhook**: When a product's stock status changes in Contentful (e.g., when it's restocked), a webhook sends a request to the backend.
2. **Stock Update Handling**: The backend processes the webhook request, updating the product’s stock status in the system.
3. **Real-Time Notification**: If a user is on the website when the product is restocked, a WebSocket connection notifies them in real time.
4. **Email Notification**: For users who signed up for "Notify Me" emails, **Nodemailer** sends a notification to their email address informing them the product is back in stock.

## Installation & Setup

1. Clone this repository:
2. Add .env with the following variables:
3. Add a `.env` file with the following variables:
   
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
