import * as config from '@config/config';
import { StreamingAvailabilityService } from '@services/streamingAvailabilityService';
import { Client, Configuration } from 'streaming-availability';

jest.mock('streaming-availability', () => {
  const mockClient = {
    showsApi: {
      getTopShows: jest.fn(),
    },
    changesApi: {
      getChanges: jest.fn(),
    },
  };

  return {
    Client: jest.fn(() => mockClient),
    Configuration: jest.fn(),
  };
});

jest.mock('@config/config', () => ({
  getStreamingAPIKey: jest.fn().mockReturnValue('mock-api-key'),
}));

describe('StreamingAvailabilityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(StreamingAvailabilityService, 'instance', { value: null, writable: true });
  });

  describe('getInstance', () => {
    it('should create a new instance when called for the first time', () => {
      Object.defineProperty(StreamingAvailabilityService, 'instance', { value: null, writable: true });

      const service = StreamingAvailabilityService.getInstance();

      expect(service).toBeInstanceOf(StreamingAvailabilityService);
      expect(Client).toHaveBeenCalledTimes(1);
      expect(Configuration).toHaveBeenCalledTimes(1);
      expect(Configuration).toHaveBeenCalledWith({
        apiKey: 'mock-api-key',
      });
    });

    it('should return the same instance when called multiple times', () => {
      const instance1 = StreamingAvailabilityService.getInstance();
      const instance2 = StreamingAvailabilityService.getInstance();
      const instance3 = StreamingAvailabilityService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(Client).toHaveBeenCalledTimes(1);
    });
  });

  describe('getClient', () => {
    it('should return the streaming availability client', () => {
      const service = StreamingAvailabilityService.getInstance();
      const client = service.getClient();

      expect(client).toBeDefined();
      expect(client).toHaveProperty('showsApi');
      expect(client).toHaveProperty('changesApi');
    });

    it('should return the same client instance for multiple calls', () => {
      const service = StreamingAvailabilityService.getInstance();
      const client1 = service.getClient();
      const client2 = service.getClient();

      expect(client1).toBe(client2);
    });
  });

  describe('constructor', () => {
    it('should initialize client with API key from environment', () => {
      const service = StreamingAvailabilityService.getInstance();

      expect(Configuration).toHaveBeenCalledWith({
        apiKey: 'mock-api-key',
      });
      expect(Client).toHaveBeenCalled();
    });

    it('should handle missing API key gracefully', () => {
      (config.getStreamingAPIKey as jest.Mock).mockReturnValueOnce(undefined);

      const service = StreamingAvailabilityService.getInstance();

      expect(Configuration).toHaveBeenCalledWith({
        apiKey: 'undefined',
      });
    });
  });

  describe('integration with client', () => {
    it('should allow calling client methods', async () => {
      const mockResponse = [{ title: 'Test Show', tmdbId: 'tv/123' }];
      const mockClient = {
        showsApi: {
          getTopShows: jest.fn().mockResolvedValue(mockResponse),
        },
        changesApi: {
          getChanges: jest.fn(),
        },
      };

      (Client as jest.Mock).mockImplementation(() => mockClient);

      Object.defineProperty(StreamingAvailabilityService, 'instance', { value: null, writable: true });
      const service = StreamingAvailabilityService.getInstance();
      const client = service.getClient();

      const result = await client.showsApi.getTopShows({
        country: 'us',
        service: 'netflix',
        showType: 'series',
      });

      expect(result).toBe(mockResponse);
      expect(client.showsApi.getTopShows).toHaveBeenCalledWith({
        country: 'us',
        service: 'netflix',
        showType: 'series',
      });
    });

    it('should integrate with changesApi methods', async () => {
      const mockResponse = { shows: { 'tv/123': { title: 'Changed Show' } } };
      const mockClient = {
        showsApi: {
          getTopShows: jest.fn(),
        },
        changesApi: {
          getChanges: jest.fn().mockResolvedValue(mockResponse),
        },
      };

      (Client as jest.Mock).mockImplementation(() => mockClient);

      Object.defineProperty(StreamingAvailabilityService, 'instance', { value: null, writable: true });
      const service = StreamingAvailabilityService.getInstance();
      const client = service.getClient();

      const result = await client.changesApi.getChanges({
        changeType: 'new',
        itemType: 'show',
        country: 'us',
        catalogs: ['netflix'],
        showType: 'series',
        orderDirection: 'asc',
        includeUnknownDates: false,
      });

      expect(result).toBe(mockResponse);
      expect(client.changesApi.getChanges).toHaveBeenCalledWith({
        changeType: 'new',
        itemType: 'show',
        country: 'us',
        catalogs: ['netflix'],
        showType: 'series',
        orderDirection: 'asc',
        includeUnknownDates: false,
      });
    });
  });
});
