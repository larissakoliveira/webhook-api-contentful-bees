import { createMocks } from 'node-mocks-http';
import { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../api/vercelWebhook';
import { fetchEmailRegistrations, sendNotificationEmails } from '../utils/utils';

jest.mock('../utils/utils');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Webhook Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 405 for non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Method Not Allowed',
    });
  });

  it('should return 400 for invalid payload', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {},
    });

    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Invalid webhook payload',
    });
  });

  it('should return 200 when product is not in stock', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        sys: { id: '123' },
        fields: {
          inStock: { 'en-US': false },
        },
      },
    });

    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Product is not back in stock',
    });
  });

  it('should process webhook and send emails when product is in stock', async () => {
    const mockEmails = ['test@example.com'];
    (fetchEmailRegistrations as jest.Mock).mockResolvedValue(mockEmails);
    (sendNotificationEmails as jest.Mock).mockResolvedValue(undefined);

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        sys: { id: '123' },
        fields: {
          inStock: { 'en-US': true },
          productNameDutch: { 'en-US': 'Test Product' },
        },
      },
    });

    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(fetchEmailRegistrations).toHaveBeenCalledWith('123');
    expect(sendNotificationEmails).toHaveBeenCalledWith(
      mockEmails,
      'Test Product'
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Emails sent successfully',
    });
  });

  it('should handle errors during processing', async () => {
    (fetchEmailRegistrations as jest.Mock).mockRejectedValue(
      new Error('Test error')
    );

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        sys: { id: '123' },
        fields: {
          inStock: { 'en-US': true },
        },
      },
    });

    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Error processing webhook',
    });
  });
});
