
# Offliner
Offliner is a proof of concept about bringing offline web applications through [service workers](http://www.html5rocks.com/en/tutorials/service-worker/introduction/?redirect_from_locale=ja).

Service workers allows the developer to intercept resource requests to the network and take control of the fetching process. In addition with caches, service workers enable the Web to success where AppCache failed.

Offliner is a project aimed to provide a service worker intended to be as transparent and automatic as possible while keeping a lot of customization power. It tries to always fetch from network and fallbacks to cache when remote resource are unreachable for any reason. Try it now!

## Before using

Please, be aware about this technology is only available in some few browsers and not all the implementations behave the same way. Offliner is intended to be used in [Chrome Canary](https://www.google.com/chrome/browser/canary.html?platform=win64) right now. If you are on Linux, try [Chrome Unstable](https://www.google.com/chrome/browser/desktop/index.html?platform=linux&extra=devchannel) instead. **Remember you need to [enable them](http://jakearchibald.com/2014/using-serviceworker-today/#in-canary-today) before using!**

Pay attention to the [progression of Service Workers implementations](https://jakearchibald.github.io/isserviceworkerready/) and [review the W3C draft](http://www.w3.org/TR/2014/WD-service-workers-20141118/) for more information.

## Usage
The only thing you need is to copy all files on this repository except the `server` folder on your site's root and add this script at the beginning of your `index.html` document:

```html
<script src="offline-cache-setup.js"></script>
```

Add the attribute `data-root` if your application is not in the root of your hosting. This is useful for `gh-pages` hosted apps.

```html
<script data-root="/my-awesome-app/" src="offline-cache-setup.js"></script>
```

## Configuring offliner

The file `cache.json` contains some useful options you can customize for tweaking **offliner**.

### networkOnly

An object with the urls to be fetched only if network is available as keys and the fallbacks for when there is no network as values. If you don't want a fallback, leave it as `true`.

Examples:

```js
"networkOnly": {
  "online.png": "offline.png"
}
```

Try to fetch a remote copy of `online.png`. If not possible answer with `offline.png` instead.

```js
"networkOnly": {
  "online.png": true
}
```

Try to fetch a remote copy. If not possible the request will fail.

### prefetch

List with resources to be prefetched. Each item can be an URL or an object. If it is an URL, it can be absolute or relative and the resource in that URL will be stored in the offline cache during the worker installation.

You can specify objects instead to pre-fetch following other strategies. The following are supported:

  * `{ "type": "zip", "url", ["prefix"] }`: get and decompress the ZIP pointed in `url` and use it to prepopulate the cache. Remember the ZIP file should be located under the same origin or in another server with a proper CORS policy. The ZIP should contain the files for the app directly, not the folder containing the files. If the creation of the ZIP is not under your control and it adds a directory, use prefix to strip it out.

## update

Stablishes the update policy. Currently only two are supported:
  * Or disabled by setting it to `false`.
  * Or set to `{ "type": "gh-pages" }`.

The second one use the gh-pages' HEAD commit hash to stablish when an update is required.

In any case, if an update is required, the prefetch process is triggered again according with the `prefetch` option.

## ghPagesTunnelServer

If your web application is hosted in gh-pages and you enable some of the GitHub integration features in the options below, you will need a tunnel due to CORS restrictions between gh-pages hosted applications and the archive where ZIPs packages reside. You will need a server to tunnel these requests and overcome CORS.

You can find such a server on the server folder and you can run it with node:

```bash
$ node.js main.js
```

## Whishlist

  * Wildcards for URLs.
  * Wait for service worker to be fully installed before entering the application via worker communication through `postMessage()`.
  * Timeout parameter to guarantee quality of service.
  * Declarative dependency graph to force all the members to be all together up to date.
  * Fine control about bustings.
  * Metadata through indexed DB.
  * ...[add yours](https://github.com/lodr/offliner/issues/new)!
