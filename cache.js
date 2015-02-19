
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
 * You can specify objects instead to pre-fetch following other strategies.
 * The following are supported:
 *
 *   * { type: 'zip', url, [prefix] }: get and decompress the ZIP pointed in
 *   url and use it to prepopulate the cache. Remember the ZIP file should be
 *   located under the same origin or in another server with proper CORS policy.
 *   The ZIP must contain the files for the app directly, not the folder
 *   containing the files. If the creation of the ZIP is not under your control
 *   and it adds a directory, use prefix to strip it out.
 */
var PREFETCH = [];

/**
 * Stablishes the update policy. Currently only two are supported:
 *   * Or disabled by setting it to `false`.
 *   * Or set to `{ type: 'gh-pages' }`
 *
 * The second one use the gh-pages' HEAD commit hash to stablish when an
 * update is required.
 *
 * In any case, if an update is required, the prefetch process is triggered
 * again according with the PREFETCH configuration.
 */
var UPDATE = false;

/**
 * If your web application is hosted in gh-pages and you enable some of the
 * GitHub integration features in the options below, you will need a tunnel
 * due to CORS restrictions between gh-pages hosted applications and the archive
 * where ZIPs packages reside. You will need a server to tunnel these
 * requests and overcome CORS.
 *
 * You can find such a server on the server folder and you can run it with
 * node: node.js main.js
 */
var GH_PAGES_TUNNEL_SERVER = 'http://localhost:4000/';
