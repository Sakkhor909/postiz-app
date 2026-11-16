import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { YoutubeProvider } from './youtube.provider';
import { GmbProvider } from './gmb.provider';
import { TumblrProvider } from './tumblr.provider';
import { LinkedinPageProvider } from './linkedin.page.provider';
import { FacebookProvider } from './facebook.provider';
import { InstagramProvider } from './instagram.provider';

describe('Providers reConnect return shapes', () => {
  describe('YoutubeProvider', () => {
    it('returns channel details with fresh refreshToken and expiresIn when provided', async () => {
      const provider = new YoutubeProvider();
      vi.spyOn(provider, 'pages').mockResolvedValue([
        {
          id: 'UC_channel_123',
          name: 'My YouTube Channel',
          picture: { data: { url: 'https://example.com/thumb.jpg' } },
          username: '@mychannel',
          subscriberCount: '1000',
        },
      ]);
      vi.spyOn(provider, 'fetchPageInformation').mockResolvedValue({
        id: 'UC_channel_123',
        name: 'My YouTube Channel',
        access_token: 'fresh-user-access-token',
        picture: 'https://example.com/thumb.jpg',
        username: '@mychannel',
      });

      const result = await provider.reConnect(
        'google-user-id',
        'UC_channel_123',
        'fresh-user-access-token',
        'fresh-refresh-token',
        3599
      );

      expect(result).toEqual({
        id: 'UC_channel_123',
        name: 'My YouTube Channel',
        accessToken: 'fresh-user-access-token',
        picture: 'https://example.com/thumb.jpg',
        username: '@mychannel',
        refreshToken: 'fresh-refresh-token',
        expiresIn: 3599,
      });
    });

    it('leaves refreshToken and expiresIn absent when not passed to reConnect', async () => {
      const provider = new YoutubeProvider();
      vi.spyOn(provider, 'pages').mockResolvedValue([
        {
          id: 'UC_channel_123',
          name: 'My YouTube Channel',
          picture: { data: { url: 'https://example.com/thumb.jpg' } },
          username: '@mychannel',
          subscriberCount: '1000',
        },
      ]);
      vi.spyOn(provider, 'fetchPageInformation').mockResolvedValue({
        id: 'UC_channel_123',
        name: 'My YouTube Channel',
        access_token: 'fresh-user-access-token',
        picture: 'https://example.com/thumb.jpg',
        username: '@mychannel',
      });

      const result = await provider.reConnect(
        'google-user-id',
        'UC_channel_123',
        'fresh-user-access-token'
      );

      expect(result.refreshToken).toBeUndefined();
      expect(result.expiresIn).toBeUndefined();
      expect(result.id).toBe('UC_channel_123');
    });

    it('throws when the target channel is not found among user channels', async () => {
      const provider = new YoutubeProvider();
      vi.spyOn(provider, 'pages').mockResolvedValue([]);

      await expect(
        provider.reConnect('google-user-id', 'non-existent', 'fresh-access-token')
      ).rejects.toThrow('Channel not found');
    });
  });

  describe('GmbProvider', () => {
    it('returns location details with fresh refreshToken and expiresIn when provided', async () => {
      const provider = new GmbProvider();
      vi.spyOn(provider, 'pages').mockResolvedValue([
        {
          id: 'locations/loc-123',
          name: 'My Business Location',
          picture: { data: { url: 'https://example.com/gmb.jpg' } },
          accountName: 'accounts/acc-1',
          locationName: 'locations/loc-123',
        },
      ]);
      vi.spyOn(provider, 'fetchPageInformation').mockResolvedValue({
        id: 'locations/loc-123',
        name: 'My Business Location',
        access_token: 'fresh-access-token',
        picture: 'https://example.com/gmb.jpg',
        username: '',
      });

      const result = await provider.reConnect(
        'google-user-id',
        'locations/loc-123',
        'fresh-access-token',
        'fresh-refresh-token',
        3599
      );

      expect(result).toEqual({
        id: 'locations/loc-123',
        name: 'My Business Location',
        accessToken: 'fresh-access-token',
        picture: 'https://example.com/gmb.jpg',
        username: '',
        refreshToken: 'fresh-refresh-token',
        expiresIn: 3599,
      });
    });

    it('leaves refreshToken and expiresIn absent when not passed to reConnect', async () => {
      const provider = new GmbProvider();
      vi.spyOn(provider, 'pages').mockResolvedValue([
        {
          id: 'locations/loc-123',
          name: 'My Business Location',
          picture: { data: { url: 'https://example.com/gmb.jpg' } },
          accountName: 'accounts/acc-1',
          locationName: 'locations/loc-123',
        },
      ]);
      vi.spyOn(provider, 'fetchPageInformation').mockResolvedValue({
        id: 'locations/loc-123',
        name: 'My Business Location',
        access_token: 'fresh-access-token',
        picture: 'https://example.com/gmb.jpg',
        username: '',
      });

      const result = await provider.reConnect(
        'google-user-id',
        'locations/loc-123',
        'fresh-access-token'
      );

      expect(result.refreshToken).toBeUndefined();
      expect(result.expiresIn).toBeUndefined();
    });
  });

  describe('TumblrProvider', () => {
    it('returns blog details with fresh refreshToken and expiresIn when provided', async () => {
      const provider = new TumblrProvider();
      vi.spyOn(provider, 'fetchPageInformation').mockResolvedValue({
        id: 'myblog',
        name: 'My Tumblr Blog',
        access_token: 'fresh-access-token',
        picture: 'https://example.com/avatar.jpg',
        username: 'myblogurl',
      });

      const result = await provider.reConnect(
        'user-id',
        'myblog',
        'fresh-access-token',
        'fresh-refresh-token',
        86400
      );

      expect(result).toEqual({
        id: 'myblog',
        name: 'My Tumblr Blog',
        accessToken: 'fresh-access-token',
        picture: 'https://example.com/avatar.jpg',
        username: 'myblogurl',
        refreshToken: 'fresh-refresh-token',
        expiresIn: 86400,
      });
    });

    it('leaves refreshToken and expiresIn absent when not passed to reConnect', async () => {
      const provider = new TumblrProvider();
      vi.spyOn(provider, 'fetchPageInformation').mockResolvedValue({
        id: 'myblog',
        name: 'My Tumblr Blog',
        access_token: 'fresh-access-token',
        picture: 'https://example.com/avatar.jpg',
        username: 'myblogurl',
      });

      const result = await provider.reConnect(
        'user-id',
        'myblog',
        'fresh-access-token'
      );

      expect(result.refreshToken).toBeUndefined();
      expect(result.expiresIn).toBeUndefined();
    });
  });

  describe('LinkedinPageProvider', () => {
    it('returns page details with fresh refreshToken and expiresIn when provided', async () => {
      const provider = new LinkedinPageProvider();
      vi.spyOn(provider, 'fetchPageInformation').mockResolvedValue({
        id: 'org-page-123',
        name: 'Company Page',
        access_token: 'fresh-access-token',
        picture: 'https://example.com/logo.jpg',
        username: 'company-vanity',
      });

      const result = await provider.reConnect(
        'user-id',
        'org-page-123',
        'fresh-access-token',
        'fresh-refresh-token',
        5184000
      );

      expect(result).toEqual({
        id: 'org-page-123',
        name: 'Company Page',
        accessToken: 'fresh-access-token',
        picture: 'https://example.com/logo.jpg',
        username: 'company-vanity',
        refreshToken: 'fresh-refresh-token',
        expiresIn: 5184000,
      });
    });

    it('leaves refreshToken and expiresIn absent when not passed to reConnect', async () => {
      const provider = new LinkedinPageProvider();
      vi.spyOn(provider, 'fetchPageInformation').mockResolvedValue({
        id: 'org-page-123',
        name: 'Company Page',
        access_token: 'fresh-access-token',
        picture: 'https://example.com/logo.jpg',
        username: 'company-vanity',
      });

      const result = await provider.reConnect(
        'user-id',
        'org-page-123',
        'fresh-access-token'
      );

      expect(result.refreshToken).toBeUndefined();
      expect(result.expiresIn).toBeUndefined();
    });
  });

  describe('FacebookProvider (leaves refresh token absent)', () => {
    it('returns page details without refreshToken or expiresIn (page token has no refresh token)', async () => {
      const provider = new FacebookProvider();
      vi.spyOn(provider, 'fetchPageInformation').mockResolvedValue({
        id: 'fb-page-123',
        name: 'Facebook Page',
        access_token: 'page-access-token',
        picture: 'https://example.com/fb.jpg',
        username: 'fbpage',
      });

      const result = await provider.reConnect(
        'fb-user-id',
        'fb-page-123',
        'user-access-token'
      );

      expect(result).toEqual({
        id: 'fb-page-123',
        name: 'Facebook Page',
        accessToken: 'page-access-token',
        picture: 'https://example.com/fb.jpg',
        username: 'fbpage',
      });
      expect(result.refreshToken).toBeUndefined();
      expect(result.expiresIn).toBeUndefined();
    });
  });

  describe('InstagramProvider (leaves refresh token absent)', () => {
    it('returns IG details without refreshToken or expiresIn (page token has no refresh token)', async () => {
      const provider = new InstagramProvider();
      vi.spyOn(provider, 'pages').mockResolvedValue([
        {
          id: 'ig-account-123',
          pageId: 'fb-page-456',
        },
      ]);
      vi.spyOn(provider, 'fetchPageInformation').mockResolvedValue({
        id: 'ig-account-123',
        name: 'Instagram Business',
        access_token: 'page-token___user-token',
        picture: 'https://example.com/ig.jpg',
        username: 'igbiz',
      });

      const result = await provider.reConnect(
        'fb-user-id',
        'ig-account-123',
        'fb-token___user-token'
      );

      expect(result).toEqual({
        id: 'ig-account-123',
        name: 'Instagram Business',
        accessToken: 'page-token___user-token',
        picture: 'https://example.com/ig.jpg',
        username: 'igbiz',
      });
      expect(result.refreshToken).toBeUndefined();
      expect(result.expiresIn).toBeUndefined();
    });
  });
});
