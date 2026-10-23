/**
 * MyDearPartner — Force Update / Version Check
 *
 * Checks the minimum required app version from the backend.
 * If the current version is below minimum, shows a blocking modal.
 * 
 * Backend: GET /api/v1/app-config/
 * Expected response: { min_version: "0.3.0", latest_version: "0.3.3", update_url: "..." }
 */

import { Alert, Linking } from 'react-native';
import { get } from '../api/apiClient';
import { version as packageVersion } from '../../package.json';
import { getStoreUrl } from './storeLinks';

// Current app version - should match app.json / build.gradle
const CURRENT_VERSION = packageVersion;

interface AppConfig {
  minVersion: string;
  latestVersion: string;
  updateUrl?: string;
  maintenance?: boolean;
  maintenanceMessage?: string;
}

/**
 * Parse semantic version string into comparable number array.
 */
function parseVersion(version: string): number[] {
  return version.split('.').map(Number);
}

function validVersion(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value) ? value : fallback;
}

/**
 * Compare two semantic versions.
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

/**
 * Fetches app config from backend and checks if update is required.
 * Should be called once on app launch (after auth).
 */
export async function checkForUpdate(): Promise<{
  updateRequired: boolean;
  updateAvailable: boolean;
  latestVersion?: string;
  maintenance?: boolean;
  maintenanceMessage?: string;
  updateUrl?: string;
}> {
  try {
    const response = await get<any>('/app-config/');

    const config: AppConfig = {
      minVersion: validVersion(response?.min_version ?? response?.minimum_version, '0.0.0'),
      latestVersion: validVersion(response?.latest_version ?? response?.current_version, CURRENT_VERSION),
      updateUrl: response?.update_url ?? response?.store_url,
      maintenance: response?.maintenance ?? response?.is_maintenance ?? false,
      maintenanceMessage: response?.maintenance_message ?? response?.maintenance_msg,
    };

    const updateRequired = compareVersions(CURRENT_VERSION, config.minVersion) < 0;
    const updateAvailable = compareVersions(CURRENT_VERSION, config.latestVersion) < 0;

    return {
      updateRequired,
      updateAvailable,
      latestVersion: config.latestVersion,
      maintenance: config.maintenance,
      maintenanceMessage: config.maintenanceMessage,
      updateUrl: getStoreUrl(config.updateUrl),
    };
  } catch {
    // If the endpoint doesn't exist yet, don't block the app
    return { updateRequired: false, updateAvailable: false, updateUrl: getStoreUrl() };
  }
}

/**
 * Shows an optional update prompt.
 */
export function showOptionalUpdateAlert(latestVersion: string, updateUrl?: string): void {
  const url = getStoreUrl(updateUrl);
  if (!url) return;
  Alert.alert(
    'Update Available',
    `A new version (${latestVersion}) of My Dear Partner is available with improvements and new features.`,
    [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Update',
        onPress: () => {
          Linking.openURL(url).catch(() => {
            Alert.alert('Could not open the store', 'Please open the app store and search for My Dear Partner.');
          });
        },
      },
    ],
  );
}

export { CURRENT_VERSION, compareVersions };
