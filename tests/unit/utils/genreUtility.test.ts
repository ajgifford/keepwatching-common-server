import { generateGenreArrayFromIds, genreIdToGenreMap } from '@utils/genreUtility';

describe('genreUtility', () => {
  describe('genreIdToGenreMap', () => {
    it('should have the correct mappings for genre IDs', () => {
      expect(genreIdToGenreMap.get(28)).toBe('Action');
      expect(genreIdToGenreMap.get(35)).toBe('Comedy');
      expect(genreIdToGenreMap.get(10749)).toBe('Romance');
      expect(genreIdToGenreMap.get(878)).toBe('Science Fiction');
      expect(genreIdToGenreMap.get(10762)).toBe('Kids');
    });

    it('should return undefined for non-existent genre IDs', () => {
      expect(genreIdToGenreMap.get(99999)).toBeUndefined();
    });
  });

  describe('generateGenreArrayFromIds', () => {
    it('should convert an array of genre IDs to genre names', () => {
      const genreIds = [28, 35, 10749];
      const result = generateGenreArrayFromIds(genreIds);

      expect(result).toEqual(['Action', 'Comedy', 'Romance']);
    });

    it('should return an empty array when given an empty array', () => {
      const result = generateGenreArrayFromIds([]);
      expect(result).toEqual([]);
    });

    it('should handle a mix of valid and invalid genre IDs', () => {
      const ids = [28, 99999, 35]; // 99999 is not in the map

      const result = generateGenreArrayFromIds(ids);
      expect(result).toEqual(['Action', 'Comedy']);
    });
  });
});
