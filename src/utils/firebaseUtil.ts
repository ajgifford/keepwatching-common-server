import admin from 'firebase-admin';
import { cliLogger } from '../logger/logger';

let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK if not already initialized
 * 
 * This function initializes Firebase Admin SDK with the service account
 * credentials from environment variables
 * 
 * @returns True if initialization was successful
 */
export function initializeFirebase(): boolean {
  if (firebaseInitialized) {
    return true;
  }

  try {
    // Check if Firebase credentials are available
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      cliLogger.warn('Firebase service account not provided, Firebase features will be disabled');
      return false;
    }

    // Initialize Firebase Admin SDK
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    cliLogger.info('Firebase Admin SDK initialized successfully');
    return true;
  } catch (error) {
    cliLogger.error('Failed to initialize Firebase Admin SDK', error);
    return false;
  }
}

/**
 * Check if Firebase Admin SDK is initialized
 * 
 * @returns True if Firebase is initialized and available
 */
export function isFirebaseInitialized(): boolean {
  return firebaseInitialized;
}

/**
 * Get Firebase Admin SDK instance
 * 
 * @returns Firebase Admin SDK instance
 * @throws Error if Firebase is not initialized
 */
export function getFirebaseAdmin(): typeof admin {
  if (!firebaseInitialized) {
    throw new Error('Firebase Admin SDK is not initialized');
  }
  
  return admin;
}
