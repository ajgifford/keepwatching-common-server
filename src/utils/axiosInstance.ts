import { getStreamingAPIHost, getStreamingAPIKey, getTMDBToken } from '../config/config';
import axios from 'axios';
import axiosRetry from 'axios-retry';

const axiosStreamingAPIInstance = axios.create({
  baseURL: 'https://streaming-availability.p.rapidapi.com',
  headers: {
    'x-rapidapi-key': `${getStreamingAPIKey()}`,
    'x-rapidapi-host': `${getStreamingAPIHost()}`,
  },
  timeout: 5000,
});

const axiosTMDBAPIInstance = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${getTMDBToken()}`,
  },
  timeout: 5000,
});

axiosRetry(axiosStreamingAPIInstance, {
  retries: 3, // Number of retries
  retryDelay: (retryCount) => {
    console.log(`Retry attempt: ${retryCount}`);
    return retryCount * 1000; // Exponential backoff (1s, 2s, 3s)
  },
  shouldResetTimeout: true, // Reset timeout on each retry
});

axiosRetry(axiosTMDBAPIInstance, {
  retries: 3, // Number of retries
  retryDelay: (retryCount) => {
    console.log(`Retry attempt: ${retryCount}`);
    return retryCount * 1000; // Exponential backoff (1s, 2s, 3s)
  },
  shouldResetTimeout: true, // Reset timeout on each retry
});

export { axiosTMDBAPIInstance, axiosStreamingAPIInstance };
