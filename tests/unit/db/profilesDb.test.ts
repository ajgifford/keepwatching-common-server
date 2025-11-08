import * as profilesDb from '@db/profilesDb';
import { ResultSetHeader } from 'mysql2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExecute, mockGetDbPool } = vi.hoisted(() => {
  const mockExecute = vi.fn();
  const mockQuery = vi.fn();
  const mockGetDbPool = vi.fn(() => ({
    execute: mockExecute,
    query: mockQuery,
  }));

  return { mockExecute, mockQuery, mockGetDbPool };
});

vi.mock('@utils/db', () => ({
  getDbPool: mockGetDbPool,
}));

vi.mock('@utils/dbMonitoring', () => ({
  DbMonitor: {
    getInstance: vi.fn(() => ({
      executeWithTiming: vi.fn().mockImplementation(async (_queryName: string, queryFn: () => any) => {
        return await queryFn();
      }),
    })),
  },
}));

describe('profileDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveProfile()', () => {
    it('save() should insert profile into DB', async () => {
      mockExecute.mockResolvedValueOnce([{ insertId: 5 } as ResultSetHeader]);
      const savedProfileId = await profilesDb.saveProfile({ accountId: 1, name: 'Test Profile' });
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith('INSERT into profiles (account_id, name) VALUES (?, ?)', [
        1,
        'Test Profile',
      ]);
      expect(savedProfileId).toBe(5);
    });

    it('should throw error when saving a profile fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);
      await expect(profilesDb.saveProfile({ accountId: 1, name: 'Test Profile' })).rejects.toThrow(
        'DB connection failed',
      );
    });

    it('should throw error with default message when saving a profile fails', async () => {
      mockExecute.mockRejectedValue({});
      await expect(profilesDb.saveProfile({ accountId: 1, name: 'Test Profile' })).rejects.toThrow(
        'Unknown database error saving a profile',
      );
    });
  });

  describe('updateProfileName()', () => {
    it('update() should update profile name', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);
      const success = await profilesDb.updateProfileName({ id: 5, name: 'Updated Profile' });
      expect(mockExecute).toHaveBeenCalledWith('UPDATE profiles SET name = ? WHERE profile_id = ?', [
        'Updated Profile',
        5,
      ]);
      expect(success).toBe(true);
    });

    it('update() should return null when no rows are affected', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);
      const success = await profilesDb.updateProfileName({ id: 5, name: 'Updated Profile' });
      expect(success).toBe(false);
    });

    it('should throw error when updating a profile fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);
      await expect(profilesDb.updateProfileName({ id: 5, name: 'Error Profile' })).rejects.toThrow(
        'DB connection failed',
      );
    });

    it('should throw error with default message when updating a profile fails', async () => {
      mockExecute.mockRejectedValue({});
      await expect(profilesDb.updateProfileName({ id: 5, name: 'Error Profile' })).rejects.toThrow(
        'Unknown database error updating a profile',
      );
    });
  });

  describe('updateProfileImage()', () => {
    it('updateProfileImage() should update profile image', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);
      const success = await profilesDb.updateProfileImage({ id: 5, image: '/path/to/image.jpg' });
      expect(mockExecute).toHaveBeenCalledWith('UPDATE profiles SET image = ? WHERE profile_id = ?', [
        '/path/to/image.jpg',
        5,
      ]);
      expect(success).toBe(true);
    });

    it('updateProfileImage() should return null when no rows are affected', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);
      const success = await profilesDb.updateProfileImage({ id: 5, image: '/path/to/image.jpg' });
      expect(success).toBe(false);
    });

    it('should throw error when updating a profile image fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);
      await expect(profilesDb.updateProfileImage({ id: 5, image: '/path/to/image.jpg' })).rejects.toThrow(
        'DB connection failed',
      );
    });

    it('should throw error with default message when updating a profile image fails', async () => {
      mockExecute.mockRejectedValue({});
      await expect(profilesDb.updateProfileImage({ id: 5, image: '/path/to/image.jpg' })).rejects.toThrow(
        'Unknown database error updating a profile image',
      );
    });
  });

  describe('deleteProfile()', () => {
    it('delete() should delete profile from DB', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);
      const result = await profilesDb.deleteProfile(5);
      expect(mockExecute).toHaveBeenCalledWith('DELETE FROM profiles WHERE profile_id = ?', [5]);
      expect(result).toBe(true);
    });

    it('delete() should return false when no rows are affected', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);
      const result = await profilesDb.deleteProfile(5);
      expect(result).toBe(false);
    });

    it('should throw error when deleting a profile fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);
      await expect(profilesDb.deleteProfile(5)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when deleting a profile fails', async () => {
      mockExecute.mockRejectedValue({});
      await expect(profilesDb.deleteProfile(5)).rejects.toThrow('Unknown database error deleting a profile');
    });
  });

  describe('findProfileById()', () => {
    it('findById() should return a profile object', async () => {
      const mockProfile = [
        {
          profile_id: 5,
          account_id: 1,
          name: 'Test Profile',
          image: null,
        },
      ];

      mockExecute.mockResolvedValueOnce([mockProfile]);

      const profile = await profilesDb.findProfileById(5);

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM profiles WHERE profile_id = ?', [5]);
      expect(profile).not.toBeNull();
      expect(profile!.id).toBe(5);
      expect(profile!.name).toBe('Test Profile');
      expect(profile!.accountId).toBe(1);
    });

    it('findById() should return null when profile is not found', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const profile = await profilesDb.findProfileById(999);
      expect(profile).toBeNull();
    });

    it('should throw error when finding a profile by id fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);
      await expect(profilesDb.findProfileById(1)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when finding a profile by id fails', async () => {
      mockExecute.mockRejectedValue({});
      await expect(profilesDb.findProfileById(1)).rejects.toThrow('Unknown database error finding a profile by id');
    });
  });

  describe('getProfilesByAccountId()', () => {
    it('getAllByAccountId() should return an array of profiles', async () => {
      const mockProfiles = [
        { profile_id: 5, account_id: 1, name: 'Profile 1', image: null },
        { profile_id: 6, account_id: 1, name: 'Profile 2', image: '/path/to/image.jpg' },
      ];

      mockExecute.mockResolvedValueOnce([mockProfiles]);

      const profiles = await profilesDb.getProfilesByAccountId(1);

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM profiles WHERE account_id = ?', [1]);
      expect(profiles.length).toBe(2);
      expect(profiles[0].id).toBe(5);
      expect(profiles[0].name).toBe('Profile 1');
      expect(profiles[1].id).toBe(6);
      expect(profiles[1].name).toBe('Profile 2');
      expect(profiles[1].image).toBe('/path/to/image.jpg');
    });

    it('should throw error when getting account profiles fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValue(mockError);

      await expect(profilesDb.getProfilesByAccountId(1)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting account profiles fails', async () => {
      mockExecute.mockRejectedValue({});

      await expect(profilesDb.getProfilesByAccountId(1)).rejects.toThrow(
        'Unknown database error getting profiles by account',
      );
    });
  });

  describe('getAdminProfilesByAccountId()', () => {
    it('should return profiles with show and movie counts', async () => {
      const mockProfiles = [
        {
          profile_id: 1,
          account_id: 5,
          name: 'Profile 1',
          image: 'profile1.jpg',
          favorited_shows: 10,
          favorited_movies: 5,
          created_at: new Date('2025-01-01'),
        },
        {
          profile_id: 2,
          account_id: 5,
          name: 'Profile 2',
          image: null,
          favorited_shows: 3,
          favorited_movies: 7,
          created_at: new Date('2025-01-02'),
        },
      ];

      const expectedProfiles = [
        {
          id: 1,
          accountId: 5,
          name: 'Profile 1',
          image: 'profile1.jpg',
          favoritedShows: 10,
          favoritedMovies: 5,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          accountId: 5,
          name: 'Profile 2',
          image: null,
          favoritedShows: 3,
          favoritedMovies: 7,
          createdAt: '2025-01-02T00:00:00.000Z',
        },
      ];

      mockExecute.mockResolvedValueOnce([mockProfiles]);

      const profiles = await profilesDb.getAdminProfilesByAccountId(5);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT p.*, (SELECT COUNT(*) FROM show_watch_status'),
        [5],
      );

      expect(profiles).toEqual(expectedProfiles);
      expect(profiles).toHaveLength(2);
      expect(profiles[0].id).toBe(1);
      expect(profiles[0].favoritedShows).toBe(10);
      expect(profiles[0].favoritedMovies).toBe(5);
      expect(profiles[1].id).toBe(2);
      expect(profiles[1].favoritedShows).toBe(3);
      expect(profiles[1].favoritedMovies).toBe(7);
    });

    it('should return empty array when no profiles exist for the account', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const profiles = await profilesDb.getAdminProfilesByAccountId(999);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT p.*, (SELECT COUNT(*) FROM show_watch_status'),
        [999],
      );

      expect(profiles).toEqual([]);
    });

    it('should throw error when getting profiles with counts fails', async () => {
      const mockError = new Error('DB connection failed');
      mockExecute.mockRejectedValueOnce(mockError);

      await expect(profilesDb.getAdminProfilesByAccountId(5)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting profiles with counts fails', async () => {
      mockExecute.mockRejectedValueOnce({});

      await expect(profilesDb.getAdminProfilesByAccountId(5)).rejects.toThrow(
        'Unknown database error getting profiles with show and movie counts by account id',
      );
    });
  });
});
