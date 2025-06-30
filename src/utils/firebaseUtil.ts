import { cliLogger } from '../logger/logger';
import admin from 'firebase-admin';

/**
 * Initialize Firebase Admin SDK if not already initialized
 *
 * This function initializes Firebase Admin SDK with the service account
 * provided
 *
 * @returns True if initialization was successful
 */
export function initializeFirebase(serviceAccount: object, name: string): boolean {
  const apps: admin.app.App[] = (admin.apps || []).filter((app) => app !== null);
  if (apps.some((app) => app.name === name)) {
    cliLogger.info(`Firebase Admin SDK already initialized for "${name}"`);
    return true;
  }

  try {
    admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
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
  const apps: admin.app.App[] = (admin.apps || []).filter((app) => app !== null);
  const app = apps.find((app) => app.name === name);
  if (!app) {
    cliLogger.info(`Firebase Admin SDK app "${name}" is not initialized`);
    return;
  }

  try {
    await admin.app(name).delete();
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
export function getFirebaseAdmin(name: string): admin.app.App | null {
  const apps: admin.app.App[] = (admin.apps || []).filter((app) => app !== null);
  return apps.find((app) => app.name === name) ?? null;
}
