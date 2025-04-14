import { filterUSOrEnglishShows } from '@utils/usSearchFilter';

describe('usSearchFilter', () => {
  describe('filterUSOrEnglishShows', () => {
    it('should return shows with US origin', () => {
      const shows = [
        { name: 'US Show', origin_country: ['US'], original_language: 'en' },
        { name: 'UK Show', origin_country: ['GB'], original_language: 'en' },
        { name: 'French Show', origin_country: ['FR'], original_language: 'fr' }
      ];

      const result = filterUSOrEnglishShows(shows);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('US Show');
      expect(result[1].name).toBe('UK Show');
    });

    it('should return shows with English language even if not US origin', () => {
      const shows = [
        { name: 'US Show', origin_country: ['US'], original_language: 'en' },
        { name: 'UK Show', origin_country: ['GB'], original_language: 'en' },
        { name: 'Canada Show', origin_country: ['CA'], original_language: 'en' },
        { name: 'French Show', origin_country: ['FR'], original_language: 'fr' }
      ];

      const result = filterUSOrEnglishShows(shows);
      
      expect(result).toHaveLength(3);
      expect(result.map(show => show.name)).toEqual(['US Show', 'UK Show', 'Canada Show']);
    });

    it('should exclude non-English shows that are not from the US', () => {
      const shows = [
        { name: 'US Show', origin_country: ['US'], original_language: 'en' },
        { name: 'US Spanish Show', origin_country: ['US'], original_language: 'es' },
        { name: 'French Show', origin_country: ['FR'], original_language: 'fr' },
        { name: 'German Show', origin_country: ['DE'], original_language: 'de' }
      ];

      const result = filterUSOrEnglishShows(shows);
      
      expect(result).toHaveLength(2);
      expect(result.map(show => show.name)).toEqual(['US Show', 'US Spanish Show']);
    });

    it('should handle shows with multiple origin countries', () => {
      const shows = [
        { name: 'US/UK Show', origin_country: ['US', 'GB'], original_language: 'en' },
        { name: 'Canada/France Show', origin_country: ['CA', 'FR'], original_language: 'fr' },
        { name: 'Germany/Italy Show', origin_country: ['DE', 'IT'], original_language: 'de' }
      ];

      const result = filterUSOrEnglishShows(shows);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('US/UK Show');
    });

    it('should return an empty array when no shows match the criteria', () => {
      const shows = [
        { name: 'French Show', origin_country: ['FR'], original_language: 'fr' },
        { name: 'German Show', origin_country: ['DE'], original_language: 'de' },
        { name: 'Spanish Show', origin_country: ['ES'], original_language: 'es' }
      ];

      const result = filterUSOrEnglishShows(shows);
      
      expect(result).toHaveLength(0);
    });

    it('should handle an empty array', () => {
      const result = filterUSOrEnglishShows([]);
      expect(result).toHaveLength(0);
    });
  });
});
