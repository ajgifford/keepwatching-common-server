import { cliLogger } from '../logger/logger';
import { App, cert, deleteApp, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';

/**
 * Initialize Firebase Admin SDK if not already initialized
 *
 * This function initializes Firebase Admin SDK with the service account
 * provided
 *
 * @returns True if initialization was successful
 */
export function initializeFirebase(serviceAccount: object, name: string): boolean {
  const apps: App[] = (getApps() || []).filter((app) => app !== null);
  if (apps.some((app) => app.name === name)) {
    cliLogger.info(`Firebase Admin SDK already initialized for "${name}"`);
    return true;
  }

  try {
    initializeApp(
      {
        credential: cert(serviceAccount),
      },
      name,
    );

    cliLogger.info(`Firebase Admin SDK initialized for "${name}"`);
    return true;
  } catch (error) {
    cliLogger.error(`Failed to initialize Firebase Admin SDK "${name}`, error);
    return false;
  }
}

export async function shutdownFirebase(name: string) {
  const apps: App[] = (getApps() || []).filter((app) => app !== null);
  const app = apps.find((app) => app.name === name);
  if (!app) {
    cliLogger.info(`Firebase Admin SDK app "${name}" is not initialized`);
    return;
  }

  try {
    await deleteApp(getApp(name));
    cliLogger.info(`Firebase Admin SDK app "${name}" deleted`);
  } catch (error) {
    cliLogger.error(`Error shutting down Firebase app "${name}"`, error);
    return;
  }
}

/**
 * Get Firebase Admin SDK instance
 *
 * @returns Firebase Admin SDK instance or null if not initialized
 */
export function getFirebaseAdmin(name: string): App | null {
  const apps: App[] = (getApps() || []).filter((app) => app !== null);
  return apps.find((app) => app.name === name) ?? null;
}

/**
 * Verify a Firebase ID token using the named app's auth instance.
 *
 * Keeping this in the common-server ensures that both initializeApp and
 * getAuth resolve to the same firebase-admin module instance, avoiding the
 * cross-package instanceof failure that breaks projectId resolution.
 *
 * @returns Decoded token payload
 * @throws FirebaseAuthError if the token is invalid or the app is not initialized
 */
export async function verifyFirebaseToken(name: string, idToken: string): Promise<DecodedIdToken> {
  const app = getFirebaseAdmin(name);
  if (!app) {
    throw new Error(`Firebase app "${name}" is not initialized`);
  }
  return getAuth(app).verifyIdToken(idToken);
}
