import * as showsDb from '@db/showsDb';
import { errorService } from '@services/errorService';
import { showService } from '@services/showService';

jest.mock('@db/showsDb');
jest.mock('@utils/db');
jest.mock('@services/errorService');

describe('showService', () => {
  describe('updateShowWatchStatusForNewContent', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should update show status from WATCHED to WATCHING for profiles with new content', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue('WATCHED');

      await showService.updateShowWatchStatusForNewContent(123, [1, 2]);

      expect(showsDb.getWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('1', 123, 'WATCHING');
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('2', 123, 'WATCHING');
    });

    it('should not update show status if already set to something other than WATCHED', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce('WATCHING');
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce('NOT_WATCHED');

      await showService.updateShowWatchStatusForNewContent(123, [1, 2]);

      expect(showsDb.getWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should do nothing if profile has no watch status record', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValue(null);

      await showService.updateShowWatchStatusForNewContent(123, [1]);

      expect(showsDb.getWatchStatus).toHaveBeenCalledTimes(1);
      expect(showsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should handle empty profile list', async () => {
      await showService.updateShowWatchStatusForNewContent(123, []);

      expect(showsDb.getWatchStatus).not.toHaveBeenCalled();
      expect(showsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should process multiple profiles with mixed statuses', async () => {
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce('WATCHED');
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce('WATCHING');
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce('WATCHED');
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce(null);

      await showService.updateShowWatchStatusForNewContent(123, [1, 2, 3, 4]);

      expect(showsDb.getWatchStatus).toHaveBeenCalledTimes(4);
      expect(showsDb.updateWatchStatus).toHaveBeenCalledTimes(2);
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('1', 123, 'WATCHING');
      expect(showsDb.updateWatchStatus).toHaveBeenCalledWith('3', 123, 'WATCHING');
    });

    it('should handle errors when getting show watch status', async () => {
      const mockError = new Error('Get show watch status failed');
      (showsDb.getWatchStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(showService.updateShowWatchStatusForNewContent(123, [1])).rejects.toThrow(
        'Get show watch status failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'updateShowWatchStatusForNewContent(123)');
      expect(showsDb.updateWatchStatus).not.toHaveBeenCalled();
    });

    it('should handle errors when updating show watch status', async () => {
      const mockError = new Error('Updating show watch status failed');
      (showsDb.getWatchStatus as jest.Mock).mockResolvedValueOnce('WATCHED');
      (showsDb.updateWatchStatus as jest.Mock).mockRejectedValue(mockError);
      (errorService.handleError as jest.Mock).mockImplementation((error) => {
        throw error;
      });

      await expect(showService.updateShowWatchStatusForNewContent(123, [1])).rejects.toThrow(
        'Updating show watch status failed',
      );

      expect(errorService.handleError).toHaveBeenCalledWith(mockError, 'updateShowWatchStatusForNewContent(123)');
      expect(showsDb.getWatchStatus).toHaveBeenCalledTimes(1);
    });
  });
});
