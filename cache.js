
/**
 * An object with the urls to be fetched only if there is network as keys
 * and the fallbacks for when there is no network as values. If you don't want
 * a fallback, leave it as true.
 *
 * Examples:
 *
 * var NETWORK_ONLY = {
 *   'online.png': 'offline.png'
 * };
 *
 * Try to fetch a remote copy of `online.png`. If not possible answer with
 * `offline.png` instead.
 *
 * var NETWORK_ONLY = {
 *   'online.png': true
 * };
 *
 * Try to fetch a remote copy. If not possible the request will fail.
 */
var NETWORK_ONLY = {};

/**
 * List with resources to be prefetched. Each item can be an URL or an object.
 * If it is an URL, it can absolute or relative and the resource in that URL
 * will be stored in the offline cache during the worker installation.
 *
 * Not supported rigth now!
 *
 * You can specify objects instead to pre-fetch following other strategies.
 * The following are supported:
 *
 *   * { type: 'zip', url }: get and decompress the ZIP pointed in url and use
 *   it to prepopulate the cache. Remember the ZIP file should be located under
 *   the same origin or without CORS.
 */
var PREFETCH = [];
