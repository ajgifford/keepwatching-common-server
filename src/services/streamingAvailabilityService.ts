import { Client, Configuration } from 'streaming-availability';

export class StreamingAvailabilityService {
  private static instance: StreamingAvailabilityService | null = null;
  private client: Client;

  /**
   * Creates a new StreamingAvailabilityService instance
   */
  private constructor() {
    this.client = new Client(
      new Configuration({
        apiKey: `${process.env.STREAMING_API_KEY}`,
      }),
    );
  }

  /**
   * Gets the singleton instance of StreamingAvailabilityService
   * @returns The singleton StreamingAvailabilityService instance
   */
  public static getInstance(): StreamingAvailabilityService {
    if (!StreamingAvailabilityService.instance) {
      StreamingAvailabilityService.instance = new StreamingAvailabilityService();
    }
    return StreamingAvailabilityService.instance;
  }

  public getClient() {
    return this.client;
  }
}
