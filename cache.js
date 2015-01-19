
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
