import {
  buildAccountImageName,
  buildDefaultImagePath,
  buildProfileImageName,
  buildTMDBImagePath,
  getAccountImage,
  getPhotoForGoogleAccount,
  getProfileImage,
} from '@utils/imageUtility';
import { describe, expect, it, vi } from 'vitest';

describe('imageUtility', () => {
  describe('buildTMDBImagePath', () => {
    it('should build path with default size', () => {
      const path = '/abc123.jpg';
      expect(buildTMDBImagePath(path)).toBe('https://image.tmdb.org/t/p/w185/abc123.jpg');
    });

    it('should build path with custom size', () => {
      const path = '/abc123.jpg';
      expect(buildTMDBImagePath(path, 'original')).toBe('https://image.tmdb.org/t/p/original/abc123.jpg');
    });
  });

  describe('buildDefaultImagePath', () => {
    it('should build a placeholder URL with account name', () => {
      expect(buildDefaultImagePath('John Doe')).toBe(
        'https://placehold.co/300x200/42a5f5/white?text=John+Doe&font=roboto',
      );
    });

    it('should properly replace spaces with plus signs', () => {
      expect(buildDefaultImagePath('John Doe Jr')).toBe(
        'https://placehold.co/300x200/42a5f5/white?text=John+Doe+Jr&font=roboto',
      );
    });
  });

  describe('buildAccountImageName', () => {
    it('should build correct account image filename with jpg extension', () => {
      // Mock Date.now() to return a fixed timestamp
      const mockDate = 1609459200000; // 2021-01-01
      vi.spyOn(Date, 'now').mockImplementation(() => mockDate);

      const id = '12345';
      const mimetype = 'image/jpeg';

      const result = buildAccountImageName(id, mimetype);
      expect(result).toBe(`accountImage_12345_${mockDate}.jpeg`);

      // Restore the original Date.now
      vi.spyOn(Date, 'now').mockRestore();
    });

    it('should build correct account image filename with png extension', () => {
      const mockDate = 1609459200000; // 2021-01-01
      vi.spyOn(Date, 'now').mockImplementation(() => mockDate);

      const id = '12345';
      const mimetype = 'image/png';

      const result = buildAccountImageName(id, mimetype);
      expect(result).toBe(`accountImage_12345_${mockDate}.png`);

      vi.spyOn(Date, 'now').mockRestore();
    });
  });

  describe('buildProfileImageName', () => {
    it('should build correct profile image filename with jpg extension', () => {
      const mockDate = 1609459200000; // 2021-01-01
      vi.spyOn(Date, 'now').mockImplementation(() => mockDate);

      const id = '12345';
      const mimetype = 'image/jpeg';

      const result = buildProfileImageName(id, mimetype);
      expect(result).toBe(`profileImage_12345_${mockDate}.jpeg`);

      vi.spyOn(Date, 'now').mockRestore();
    });

    it('should build correct profile image filename with png extension', () => {
      const mockDate = 1609459200000; // 2021-01-01
      vi.spyOn(Date, 'now').mockImplementation(() => mockDate);

      const id = '12345';
      const mimetype = 'image/png';

      const result = buildProfileImageName(id, mimetype);
      expect(result).toBe(`profileImage_12345_${mockDate}.png`);

      vi.spyOn(Date, 'now').mockRestore();
    });
  });

  describe('getPhotoForGoogleAccount', () => {
    it('should return uploaded image when image is provided', () => {
      const name = 'John Doe';
      const photoURL = 'https://google.photos/123';
      const image = 'profile123.jpg';

      expect(getPhotoForGoogleAccount(name, photoURL, image)).toBe('/uploads/accounts/profile123.jpg');
    });

    it('should return photoURL when image is not provided but photoURL is', () => {
      const name = 'John Doe';
      const photoURL = 'https://google.photos/123';
      const image = undefined;

      expect(getPhotoForGoogleAccount(name, photoURL, image)).toBe('https://google.photos/123');
    });

    it('should return default image when neither image nor photoURL is provided', () => {
      const name = 'John Doe';
      const photoURL = undefined;
      const image = undefined;

      expect(getPhotoForGoogleAccount(name, photoURL, image)).toBe(
        'https://placehold.co/300x200/42a5f5/white?text=John+Doe&font=roboto',
      );
    });
  });

  describe('getAccountImage', () => {
    it('should return uploaded image path when image is provided', () => {
      const name = 'John Doe';
      const image = 'account123.jpg';

      expect(getAccountImage(image, name)).toBe('/uploads/accounts/account123.jpg');
    });

    it('should return default image when image is not provided', () => {
      const name = 'John Doe';
      const image = undefined;

      expect(getAccountImage(image, name)).toBe('https://placehold.co/300x200/42a5f5/white?text=John+Doe&font=roboto');
    });
  });

  describe('getProfileImage', () => {
    it('should return uploaded image path when image is provided', () => {
      const name = 'John Doe';
      const image = 'profile123.jpg';

      expect(getProfileImage(image, name)).toBe('/uploads/profiles/profile123.jpg');
    });

    it('should return default image when image is not provided', () => {
      const name = 'John Doe';
      const image = undefined;

      expect(getProfileImage(image, name)).toBe('https://placehold.co/300x200/42a5f5/white?text=John+Doe&font=roboto');
    });
  });
});
