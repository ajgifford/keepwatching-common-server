import { CacheService } from '@services/cacheService';

describe('CacheService Singleton Pattern', () => {
  it('should return the same instance when getInstance is called multiple times', () => {
    const instance1 = CacheService.getInstance();
    const instance2 = CacheService.getInstance();

    expect(instance1).toBe(instance2);
  });

  it('should share the same cache data between instances', async () => {
    const instance1 = CacheService.getInstance();
    const instance2 = CacheService.getInstance();

    // Set a value using instance1
    instance1.set('test-key', 'test-value');

    // Get the value using instance2
    const value = instance2.get('test-key');

    expect(value).toBe('test-value');
  });

  it('should handle cache invalidation across instances', () => {
    const instance1 = CacheService.getInstance();
    const instance2 = CacheService.getInstance();

    // Set a value using instance1
    instance1.set('another-key', 'another-value');

    // Invalidate using instance2
    instance2.invalidate('another-key');

    // Try to get the value using instance1
    const value = instance1.get('another-key');

    expect(value).toBeUndefined();
  });

  it('should properly handle getOrSet across instances', async () => {
    const instance1 = CacheService.getInstance();
    const instance2 = CacheService.getInstance();

    // First call will execute the function
    const mockFn = jest.fn().mockResolvedValue('computed-value');
    const value1 = await instance1.getOrSet('computed-key', mockFn);

    expect(value1).toBe('computed-value');
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Second call from different instance should use cached value
    const value2 = await instance2.getOrSet('computed-key', mockFn);

    expect(value2).toBe('computed-value');
    // Function should not have been called again
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
