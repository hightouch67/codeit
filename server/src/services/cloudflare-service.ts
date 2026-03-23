import { env } from '../config/index.js';

/**
 * Cloudflare DNS management is handled via a single wildcard A record
 * (*.codeit.brickvue.com → server IP) set manually in the Cloudflare dashboard.
 * Nginx routes subdomain requests to the user proxy (port 8081) which
 * then proxies to the correct per-user Expo process.
 *
 * No Cloudflare API calls are needed at runtime.
 */

export function getSubdomainUrl(subdomain: string): string {
  return `https://${subdomain}.${env.CODEIT_DOMAIN}`;
}

export function getUserSubdomain(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9-]/g, '');
}
