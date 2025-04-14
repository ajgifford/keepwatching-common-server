import * as profilesDb from '@db/profilesDb';
import { getDbPool } from '@utils/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

jest.mock('@utils/db', () => {
  const mockPool = {
    execute: jest.fn(),
  };
  return {
    getDbPool: jest.fn(() => mockPool),
  };
});

describe('profileDb', () => {
  let mockPool: any;

  beforeEach(() => {
    mockPool = getDbPool();
    mockPool.execute.mockReset();
  });

  describe('saveProfile()', () => {
    it('save() should insert profile into DB', async () => {
      mockPool.execute.mockResolvedValueOnce([{ insertId: 5 } as ResultSetHeader]);

      const profile = profilesDb.createProfile(1, 'Test Profile');
      const savedProfile = await profilesDb.saveProfile(profile);

      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith('INSERT into profiles (account_id, name) VALUES (?, ?)', [
        1,
        'Test Profile',
      ]);
      expect(savedProfile.id).toBe(5);
    });

    it('should throw error when saving a profile fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      const profile = profilesDb.createProfile(1, 'Test Profile');
      await expect(profilesDb.saveProfile(profile)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when saving a profile fails', async () => {
      mockPool.execute.mockRejectedValue({});

      const profile = profilesDb.createProfile(1, 'Test Profile');
      await expect(profilesDb.saveProfile(profile)).rejects.toThrow('Unknown database error saving a profile');
    });
  });

  describe('updateProfileName()', () => {
    it('update() should update profile name', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      const profile = profilesDb.createProfile(1, 'Test Profile', 5);
      const updatedProfile = await profilesDb.updateProfileName(profile, 'Updated Profile');

      expect(mockPool.execute).toHaveBeenCalledWith('UPDATE profiles SET name = ? WHERE profile_id = ?', [
        'Updated Profile',
        5,
      ]);
      expect(updatedProfile).not.toBeNull();
      expect(updatedProfile?.name).toBe('Updated Profile');
    });

    it('update() should return null when no rows are affected', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const profile = profilesDb.createProfile(1, 'Test Profile', 5);
      const updatedProfile = await profilesDb.updateProfileName(profile, 'Updated Profile');

      expect(updatedProfile).toBeNull();
    });

    it('should throw error when updating a profile fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      const profile = profilesDb.createProfile(1, 'Test Profile');
      await expect(profilesDb.updateProfileName(profile, 'Error Profile')).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when updating a profile fails', async () => {
      mockPool.execute.mockRejectedValue({});

      const profile = profilesDb.createProfile(1, 'Test Profile');
      await expect(profilesDb.updateProfileName(profile, 'Error Profile')).rejects.toThrow(
        'Unknown database error updating a profile',
      );
    });
  });

  describe('updateProfileImage()', () => {
    it('updateProfileImage() should update profile image', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      const profile = profilesDb.createProfile(1, 'Test Profile', 5);
      const updatedProfile = await profilesDb.updateProfileImage(profile, '/path/to/image.jpg');

      expect(mockPool.execute).toHaveBeenCalledWith('UPDATE profiles SET image = ? WHERE profile_id = ?', [
        '/path/to/image.jpg',
        5,
      ]);
      expect(updatedProfile).not.toBeNull();
      expect(updatedProfile?.image).toBe('/path/to/image.jpg');
    });

    it('updateProfileImage() should return null when no rows are affected', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const profile = profilesDb.createProfile(1, 'Test Profile', 5);
      const updatedProfile = await profilesDb.updateProfileImage(profile, '/path/to/image.jpg');

      expect(updatedProfile).toBeNull();
    });

    it('should throw error when updating a profile image fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      const profile = profilesDb.createProfile(1, 'Test Profile');
      await expect(profilesDb.updateProfileImage(profile, 'new image')).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when updating a profile image fails', async () => {
      mockPool.execute.mockRejectedValue({});

      const profile = profilesDb.createProfile(1, 'Test Profile');
      await expect(profilesDb.updateProfileImage(profile, 'new image')).rejects.toThrow(
        'Unknown database error updating a profile image',
      );
    });
  });

  describe('deleteProfile()', () => {
    it('delete() should delete profile from DB', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader]);

      const profile = profilesDb.createProfile(1, 'Test Profile', 5);
      const result = await profilesDb.deleteProfile(profile);

      expect(mockPool.execute).toHaveBeenCalledWith('DELETE FROM profiles WHERE profile_id = ?', [5]);
      expect(result).toBe(true);
    });

    it('delete() should return false when no rows are affected', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader]);

      const profile = profilesDb.createProfile(1, 'Test Profile', 5);
      const result = await profilesDb.deleteProfile(profile);

      expect(result).toBe(false);
    });

    it('should throw error when deleting a profile fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      const profile = profilesDb.createProfile(1, 'Test Profile');
      await expect(profilesDb.deleteProfile(profile)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when deleting a profile fails', async () => {
      mockPool.execute.mockRejectedValue({});

      const profile = profilesDb.createProfile(1, 'Test Profile');
      await expect(profilesDb.deleteProfile(profile)).rejects.toThrow('Unknown database error deleting a profile');
    });
  });

  describe('findProfileById()', () => {
    it('findById() should return a profile object', async () => {
      const mockProfile = {
        profile_id: 5,
        account_id: 1,
        name: 'Test Profile',
        image: null,
      };

      mockPool.execute.mockResolvedValueOnce([[mockProfile] as RowDataPacket[]]);

      const profile = await profilesDb.findProfileById(5);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM profiles WHERE profile_id = ?', [5]);
      expect(profile).not.toBeNull();
      expect(profile?.id).toBe(5);
      expect(profile?.name).toBe('Test Profile');
      expect(profile?.account_id).toBe(1);
    });

    it('findById() should return null when profile is not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[]]);

      const profile = await profilesDb.findProfileById(999);

      expect(profile).toBeNull();
    });

    it('should throw error when finding a profile by id fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(profilesDb.findProfileById(1)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when finding a profile by id fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(profilesDb.findProfileById(1)).rejects.toThrow('Unknown database error finding a profile by id');
    });
  });

  describe('getAllProfilesByAccountId()', () => {
    it('getAllByAccountId() should return an array of profiles', async () => {
      const mockProfiles = [
        { profile_id: 5, account_id: 1, name: 'Profile 1', image: null },
        { profile_id: 6, account_id: 1, name: 'Profile 2', image: '/path/to/image.jpg' },
      ];

      mockPool.execute.mockResolvedValueOnce([mockProfiles as RowDataPacket[]]);

      const profiles = await profilesDb.getAllProfilesByAccountId(1);

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM profiles WHERE account_id = ?', [1]);
      expect(profiles.length).toBe(2);
      expect(profiles[0].id).toBe(5);
      expect(profiles[0].name).toBe('Profile 1');
      expect(profiles[1].id).toBe(6);
      expect(profiles[1].name).toBe('Profile 2');
      expect(profiles[1].image).toBe('/path/to/image.jpg');
    });

    it('should throw error when getting account profiles fails', async () => {
      const mockError = new Error('DB connection failed');
      mockPool.execute.mockRejectedValue(mockError);

      await expect(profilesDb.getAllProfilesByAccountId(1)).rejects.toThrow('DB connection failed');
    });

    it('should throw error with default message when getting account profiles fails', async () => {
      mockPool.execute.mockRejectedValue({});

      await expect(profilesDb.getAllProfilesByAccountId(1)).rejects.toThrow(
        'Unknown database error getting all profiles by account',
      );
    });
  });
});
