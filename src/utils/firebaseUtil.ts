import { cliLogger } from '../logger/logger';
import admin from 'firebase-admin';

let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK if not already initialized
 *
 * This function initializes Firebase Admin SDK with the service account
 * provided
 *
 * @returns True if initialization was successful
 */
export function initializeFirebase(serviceAccount: object): boolean {
  if (firebaseInitialized) {
    return true;
  }

  try {
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

export async function shutdownFirebase() {
  if (!firebaseInitialized) {
    cliLogger.info('Firebase Admin SDK is not initialized');
    return;
  }

  try {
    await admin.app().delete();
    firebaseInitialized = false;
  } catch (error) {
    cliLogger.error('Failed to initialize Firebase Admin SDK', error);
    return;
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
