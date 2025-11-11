import { InMemoryStatsStore } from '../../../../src/utils/stores/InMemoryStatsStore';

describe('InMemoryStatsStore', () => {
  let store: InMemoryStatsStore;

  beforeEach(() => {
    store = new InMemoryStatsStore();
  });

  describe('recordQuery', () => {
    it('should record a new query', async () => {
      await store.recordQuery('testQuery', 100);

      const stats = await store.getStats();
      expect(stats).toHaveLength(1);
      expect(stats[0]).toEqual({
        query: 'testQuery',
        count: 1,
        totalTime: 100,
        maxTime: 100,
        avgTime: 100,
      });
    });

    it('should increment count for repeated queries', async () => {
      await store.recordQuery('testQuery', 100);
      await store.recordQuery('testQuery', 150);
      await store.recordQuery('testQuery', 200);

      const stats = await store.getStats();
      expect(stats).toHaveLength(1);
      expect(stats[0].count).toBe(3);
    });

    it('should accumulate total time correctly', async () => {
      await store.recordQuery('testQuery', 100);
      await store.recordQuery('testQuery', 150);
      await store.recordQuery('testQuery', 250);

      const stats = await store.getStats();
      expect(stats[0].totalTime).toBe(500); // 100 + 150 + 250
    });

    it('should track maximum execution time', async () => {
      await store.recordQuery('testQuery', 100);
      await store.recordQuery('testQuery', 300); // Max
      await store.recordQuery('testQuery', 150);

      const stats = await store.getStats();
      expect(stats[0].maxTime).toBe(300);
    });

    it('should calculate average time correctly', async () => {
      await store.recordQuery('testQuery', 100);
      await store.recordQuery('testQuery', 200);
      await store.recordQuery('testQuery', 300);

      const stats = await store.getStats();
      expect(stats[0].avgTime).toBe(200); // (100 + 200 + 300) / 3
    });

    it('should handle multiple different queries', async () => {
      await store.recordQuery('query1', 100);
      await store.recordQuery('query2', 200);
      await store.recordQuery('query3', 300);

      const stats = await store.getStats();
      expect(stats).toHaveLength(3);
      expect(stats.map((s) => s.query)).toContain('query1');
      expect(stats.map((s) => s.query)).toContain('query2');
      expect(stats.map((s) => s.query)).toContain('query3');
    });
  });

  describe('getStats', () => {
    it('should return empty array when no queries recorded', async () => {
      const stats = await store.getStats();
      expect(stats).toEqual([]);
    });

    it('should return stats sorted by total time descending', async () => {
      // Record queries with different total times
      await store.recordQuery('slowQuery', 1000);

      await store.recordQuery('mediumQuery', 300);
      await store.recordQuery('mediumQuery', 300);

      await store.recordQuery('fastQuery', 100);

      const stats = await store.getStats();

      expect(stats[0].query).toBe('slowQuery'); // 1000 total
      expect(stats[1].query).toBe('mediumQuery'); // 600 total
      expect(stats[2].query).toBe('fastQuery'); // 100 total
    });

    it('should round avgTime and maxTime', async () => {
      await store.recordQuery('testQuery', 100);
      await store.recordQuery('testQuery', 150);

      const stats = await store.getStats();
      expect(stats[0].avgTime).toBe(125); // (100 + 150) / 2
      expect(Number.isInteger(stats[0].avgTime)).toBe(true);
      expect(Number.isInteger(stats[0].maxTime)).toBe(true);
      expect(Number.isInteger(stats[0].totalTime)).toBe(true);
    });
  });

  describe('clearStats', () => {
    it('should remove all recorded statistics', async () => {
      await store.recordQuery('query1', 100);
      await store.recordQuery('query2', 200);
      await store.recordQuery('query3', 300);

      let stats = await store.getStats();
      expect(stats).toHaveLength(3);

      await store.clearStats();

      stats = await store.getStats();
      expect(stats).toHaveLength(0);
    });

    it('should allow recording new stats after clearing', async () => {
      await store.recordQuery('query1', 100);
      await store.clearStats();
      await store.recordQuery('query2', 200);

      const stats = await store.getStats();
      expect(stats).toHaveLength(1);
      expect(stats[0].query).toBe('query2');
    });
  });

  describe('disconnect', () => {
    it('should not throw when called', async () => {
      await expect(store.disconnect()).resolves.not.toThrow();
    });

    it('should be a no-op that allows continued usage', async () => {
      await store.recordQuery('query1', 100);
      await store.disconnect();

      // Should still work after disconnect
      await store.recordQuery('query2', 200);
      const stats = await store.getStats();
      expect(stats).toHaveLength(2);
    });
  });

  describe('helper methods', () => {
    describe('hasQuery', () => {
      it('should return false for non-existent query', () => {
        expect(store.hasQuery('nonExistent')).toBe(false);
      });

      it('should return true for recorded query', async () => {
        await store.recordQuery('testQuery', 100);
        expect(store.hasQuery('testQuery')).toBe(true);
      });

      it('should return false after clearing stats', async () => {
        await store.recordQuery('testQuery', 100);
        await store.clearStats();
        expect(store.hasQuery('testQuery')).toBe(false);
      });
    });

    describe('getQueryStat', () => {
      it('should return undefined for non-existent query', () => {
        expect(store.getQueryStat('nonExistent')).toBeUndefined();
      });

      it('should return raw stats for recorded query', async () => {
        await store.recordQuery('testQuery', 100);
        await store.recordQuery('testQuery', 200);

        const stat = store.getQueryStat('testQuery');
        expect(stat).toEqual({
          count: 2,
          totalTime: 300,
          maxTime: 200,
        });
      });

      it('should return updated stats on subsequent queries', async () => {
        await store.recordQuery('testQuery', 100);
        let stat = store.getQueryStat('testQuery');
        expect(stat?.count).toBe(1);

        await store.recordQuery('testQuery', 200);
        stat = store.getQueryStat('testQuery');
        expect(stat?.count).toBe(2);
        expect(stat?.totalTime).toBe(300);
      });
    });
  });
});
