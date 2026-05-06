/**
 * Utility per ottenere l'URL dell'app
 * Supporta sia ambiente locale che produzione
 */
export function getAppUrl(): string {
  const rawUrl = process.env.APP_URL || 'http://localhost:3000';
  return rawUrl.replace(/\/+$/, '');
}