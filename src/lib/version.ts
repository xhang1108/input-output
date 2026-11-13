import pkg from '../../package.json';

/**
 * Single source of truth for the application version.
 *
 * The value comes from `package.json` (`npm version` keeps the lockfile in
 * sync). Never hardcode a version string in UI or docs — import this instead.
 *
 * Note: this is the *app* version. The save-file schema version is separate and
 * lives in `Serializer.VERSION`.
 */
export const APP_VERSION: string = pkg.version;
