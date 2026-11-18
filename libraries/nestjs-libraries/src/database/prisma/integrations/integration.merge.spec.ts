import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationRepository } from './integration.repository';
import { IntegrationService } from './integration.service';

describe('IntegrationRepository.updateIntegration - two-step merge', () => {
  let updates: Array<{ where: any; data: any }>;
  let repository: IntegrationRepository;

  beforeEach(() => {
    updates = [];

    const integrationModel = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'survivor',
        refreshToken: 'old-rt',
        tokenExpiration: new Date('2026-01-01T00:00:00.000Z'),
      }),
      update: vi.fn(async ({ where, data }: any) => {
        updates.push({ where, data });
        return { id: where.id, ...data };
      }),
    };

    repository = new IntegrationRepository(
      { model: { integration: integrationModel } } as any,
      { model: { post: { updateMany: vi.fn() } } } as any,
      { model: {} } as any,
      { model: {} } as any,
      { model: {} } as any,
      { model: {} } as any
    );
  });

  it('merges the fresh credentials onto the surviving row, not the fresh id', async () => {
    const before = Date.now();

    await repository.updateIntegration('fresh', {
      organizationId: 'org-1',
      internalId: 'channel-1',
      name: 'Channel',
      refreshToken: 'fresh-rt',
      expiresIn: 3599,
    });

    expect(updates).toHaveLength(2);
    expect(updates[0].where).toEqual({ id: 'fresh' });
    expect(updates[1].where).toEqual({ id: 'survivor' });

    const mergeData = updates[1].data;
    expect(mergeData.refreshToken).toBe('fresh-rt');

    const expiration = mergeData.tokenExpiration;
    expect(expiration).toBeInstanceOf(Date);
    const delta = expiration.getTime() - before;
    expect(delta).toBeGreaterThan(3500 * 1000);
    expect(delta).toBeLessThanOrEqual(3599 * 1000 + 5000);
    expect(delta).not.toBe(999999999 * 1000);
  });

  it('preserves the survivor credentials when the caller passes none', async () => {
    await repository.updateIntegration('fresh', {
      organizationId: 'org-1',
      internalId: 'channel-1',
      name: 'Channel',
    });

    const mergeData = updates[1].data;
    expect(mergeData).not.toHaveProperty('refreshToken');
    expect(mergeData).not.toHaveProperty('tokenExpiration');
  });
});

describe('IntegrationService.saveProviderPage - refresh workflow target', () => {
  it('starts the refresh workflow on the surviving integration id', async () => {
    const provider = {
      identifier: 'threads',
      refreshCron: true,
      fetchPageInformation: vi.fn().mockResolvedValue({
        id: 'channel-1',
        name: 'Channel',
        access_token: 'page-access-token',
        picture: 'https://example.com/pic.jpg',
        username: 'channel',
      }),
    };

    const updateIntegration = vi.fn().mockResolvedValue({ id: 'survivor' });
    const startRefreshWorkflow = vi.fn().mockResolvedValue(undefined);

    const service = new IntegrationService(
      {
        getIntegrationById: vi.fn().mockResolvedValue({
          id: 'fresh',
          organizationId: 'org-1',
          providerIdentifier: 'threads',
          inBetweenSteps: true,
          token: 'fresh-access-token',
          refreshToken: 'fresh-rt',
          tokenExpiration: new Date(Date.now() + 3599 * 1000),
        }),
        checkForDeletedOnceAndUpdate: vi.fn().mockResolvedValue(undefined),
        updateIntegration,
      } as any,
      {} as any,
      { getSocialIntegration: vi.fn().mockReturnValue(provider) } as any,
      {} as any,
      { startRefreshWorkflow } as any,
      {} as any
    );

    const result = await service.saveProviderPage('org-1', 'fresh', {
      id: 'channel-1',
    });

    expect(result).toEqual({ success: true });
    expect(updateIntegration).toHaveBeenCalledTimes(1);

    const params = updateIntegration.mock.calls[0][1];
    expect(params.refreshToken).toBe('fresh-rt');
    expect(params.expiresIn).toBeGreaterThan(3500);
    expect(params.expiresIn).toBeLessThanOrEqual(3600);

    expect(startRefreshWorkflow).toHaveBeenCalledTimes(1);
    expect(startRefreshWorkflow).toHaveBeenCalledWith(
      'org-1',
      'survivor',
      provider
    );
  });
});
