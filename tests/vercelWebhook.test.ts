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

  const fullProductNames = {
    productNameEnglish: { 'en-US': 'Test EN' },
    productNameDutch: { 'en-US': 'Test NL' },
    productNamePortuguese: { 'en-US': 'Test PT' },
    productNameGerman: { 'en-US': 'Test DE' },
  };

  const nlEnOnlyNames = {
    productNameEnglish: { 'en-US': 'Test EN' },
    productNameDutch: { 'en-US': 'Test NL' },
  };

  it('should process webhook and send emails when product is in stock', async () => {
    const mockRegistrations = [
      {
        email: 'test@example.com',
        relatedProduct: { sys: { type: 'Link', linkType: 'Entry', id: 'p1' } },
        entryId: 'e1',
        language: 'en' as const,
      },
    ];
    (fetchEmailRegistrations as jest.Mock).mockResolvedValue(mockRegistrations);
    (sendNotificationEmails as jest.Mock).mockResolvedValue({ sent: 1, failed: 0, skippedEmpty: 0 });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        sys: { id: '123' },
        fields: {
          inStock: { 'en-US': true },
          ...fullProductNames,
        },
      },
    });

    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(fetchEmailRegistrations).toHaveBeenCalledWith('123');
    expect(sendNotificationEmails).toHaveBeenCalledWith(mockRegistrations, {
      en: 'Test EN',
      nl: 'Test NL',
      pt: 'Test PT',
      de: 'Test DE',
    });
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      message: 'Notification email(s) handed off to mail server',
      queued: 1,
      sent: 1,
      failed: 0,
      skippedEmpty: 0,
    });
  });

  it('should process webhook when only Dutch and English names exist (PT/DE fall back to EN)', async () => {
    const mockRegistrations = [
      {
        email: 'test@example.com',
        relatedProduct: { sys: { type: 'Link', linkType: 'Entry', id: 'p1' } },
        entryId: 'e1',
        language: 'pt' as const,
      },
    ];
    (fetchEmailRegistrations as jest.Mock).mockResolvedValue(mockRegistrations);
    (sendNotificationEmails as jest.Mock).mockResolvedValue({ sent: 1, failed: 0, skippedEmpty: 0 });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        sys: { id: '123' },
        fields: {
          inStock: { 'en-US': true },
          ...nlEnOnlyNames,
        },
      },
    });

    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);

    expect(sendNotificationEmails).toHaveBeenCalledWith(mockRegistrations, {
      en: 'Test EN',
      nl: 'Test NL',
      pt: 'Test EN',
      de: 'Test EN',
    });
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData()).sent).toBe(1);
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
          ...fullProductNames,
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
