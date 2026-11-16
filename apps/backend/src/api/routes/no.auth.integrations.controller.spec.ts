import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoAuthIntegrationsController } from './no.auth.integrations.controller';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

vi.mock('@gitroom/nestjs-libraries/redis/redis.service', () => ({
  ioRedis: {
    get: vi.fn(),
    del: vi.fn(),
  },
}));

describe('NoAuthIntegrationsController - reconnect token handling', () => {
  let controller: NoAuthIntegrationsController;
  let mockIntegrationManager: any;
  let mockIntegrationService: any;
  let mockRefreshIntegrationService: any;
  let mockOrganizationService: any;
  let mockProvider: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProvider = {
      identifier: 'youtube',
      authenticate: vi.fn(),
      reConnect: vi.fn(),
      isBetweenSteps: false,
    };

    mockIntegrationManager = {
      getAllowedSocialsIntegrations: vi.fn().mockReturnValue(['youtube']),
      getSocialIntegration: vi.fn().mockReturnValue(mockProvider),
    };

    mockIntegrationService = {
      checkPreviousConnections: vi.fn().mockResolvedValue(false),
      createOrUpdateIntegration: vi.fn().mockResolvedValue({
        id: 'integration-db-id',
        internalId: 'channel-id-123',
      }),
    };

    mockRefreshIntegrationService = {
      startRefreshWorkflow: vi.fn().mockResolvedValue(undefined),
    };

    mockOrganizationService = {
      getOrgById: vi.fn().mockResolvedValue({
        id: 'org-1',
        apiKey: 'org-api-key',
        isTrailing: false,
      }),
    };

    controller = new NoAuthIntegrationsController(
      mockIntegrationManager,
      mockIntegrationService,
      mockRefreshIntegrationService,
      mockOrganizationService
    );
  });

  it('keeps fresh refreshToken and expiresIn from authenticate() during reconnect', async () => {
    const state = 'state-abc-123';
    const oldStaleRefresh = 'old-stale-refresh-token';
    const existingChannelId = 'UC_channel_123';

    // Redis state mocks
    (ioRedis.get as any).mockImplementation(async (key: string) => {
      if (key === `login:${state}`) return 'code-verifier-val';
      if (key === `organization:${state}`) return 'org-1';
      if (key === `refresh:${state}`) return existingChannelId;
      return null;
    });

    // Authenticate returns fresh tokens from Google OAuth
    mockProvider.authenticate.mockResolvedValue({
      id: 'google-user-id',
      name: 'Google Account',
      accessToken: 'fresh-access-token',
      refreshToken: 'new-rt',
      expiresIn: 3599,
      picture: 'https://example.com/pic.jpg',
      username: 'googleuser',
    });

    // Provider reConnect returns channel information
    mockProvider.reConnect.mockResolvedValue({
      id: existingChannelId,
      name: 'YouTube Channel Name',
      accessToken: 'fresh-access-token',
      picture: 'https://example.com/channel.jpg',
      username: 'ytchannel',
      refreshToken: 'new-rt',
      expiresIn: 3599,
    });

    await controller.connectSocialMedia('youtube', {
      state,
      code: 'auth-code',
      timezone: '0',
      refresh: oldStaleRefresh,
    });

    // reConnect must receive the fresh credentials
    expect(mockProvider.reConnect).toHaveBeenCalledWith(
      'google-user-id',
      existingChannelId,
      'fresh-access-token',
      'new-rt',
      3599
    );

    // createOrUpdateIntegration must receive the fresh refreshToken and expiresIn,
    // not body.refresh or a default, while body.refresh is passed separately as parameter 14
    expect(mockIntegrationService.createOrUpdateIntegration).toHaveBeenCalledTimes(1);
    const callArgs = mockIntegrationService.createOrUpdateIntegration.mock.calls[0];

    // Signature: (additionalSettings, oneTimeToken, org, name, picture, type,
    //             internalId, provider, token, refreshToken, expiresIn, username,
    //             isBetweenSteps, refresh, timezone, customInstanceDetails)
    expect(callArgs[6]).toBe(existingChannelId); // internalId
    expect(callArgs[7]).toBe('youtube'); // provider
    expect(callArgs[8]).toBe('fresh-access-token'); // token
    expect(callArgs[9]).toBe('new-rt'); // refreshToken (MUST NOT be oldStaleRefresh)
    expect(callArgs[10]).toBe(3599); // expiresIn (MUST NOT be undefined or default 999999999)
    expect(callArgs[13]).toBe(oldStaleRefresh); // refresh parameter (retained for backward compatibility)
  });

  it('falls back to auth.refreshToken and auth.expiresIn when provider reConnect does not return them', async () => {
    const state = 'state-xyz-456';
    const oldStaleRefresh = 'old-stale-rt';
    const existingChannelId = 'UC_channel_456';

    (ioRedis.get as any).mockImplementation(async (key: string) => {
      if (key === `login:${state}`) return 'code-verifier-val';
      if (key === `organization:${state}`) return 'org-1';
      if (key === `refresh:${state}`) return existingChannelId;
      return null;
    });

    mockProvider.authenticate.mockResolvedValue({
      id: 'google-user-id',
      name: 'Google Account',
      accessToken: 'fresh-access-token',
      refreshToken: 'new-rt',
      expiresIn: 3599,
      picture: 'https://example.com/pic.jpg',
      username: 'googleuser',
    });

    // Provider reConnect returns only profile fields without refreshToken/expiresIn
    mockProvider.reConnect.mockResolvedValue({
      id: existingChannelId,
      name: 'YouTube Channel Name',
      accessToken: 'fresh-access-token',
      picture: 'https://example.com/channel.jpg',
      username: 'ytchannel',
    });

    await controller.connectSocialMedia('youtube', {
      state,
      code: 'auth-code',
      timezone: '0',
      refresh: oldStaleRefresh,
    });

    expect(mockIntegrationService.createOrUpdateIntegration).toHaveBeenCalledTimes(1);
    const callArgs = mockIntegrationService.createOrUpdateIntegration.mock.calls[0];

    expect(callArgs[9]).toBe('new-rt');
    expect(callArgs[10]).toBe(3599);
    expect(callArgs[13]).toBe(oldStaleRefresh);
  });
});
