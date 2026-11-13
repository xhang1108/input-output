/**
 * Save-file schema version — the single constant for the serialized project
 * format. This is intentionally independent of the app version
 * (`package.json` / `APP_VERSION`): bump it only when the stored format
 * actually changes, never on a release.
 *
 * Readers must preserve the `version` already stored in a file; this value is
 * only the default for payloads that have none.
 */
export const SCHEMA_VERSION = '1.0.0';
