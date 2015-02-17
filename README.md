
# Offliner
Offliner is a proof of concept about bringing offline web applications through [service workers](http://www.html5rocks.com/en/tutorials/service-worker/introduction/?redirect_from_locale=ja).

Service workers allows the developer to intercept resource requests to the network and take control of the fetching process. In addition with caches, service workers enable the Web to success where AppCache failed.

Offliner is a project aimed to provide a service worker intended to be as transparent and automatic as possible while keeping a lot of customization power. It tries to always fetch from network and fallbacks to cache when remote resource are unreachable for any reason. Try it now!

## Before using

Please, be aware about this technology is only available in some few browsers and not all the implementations behave the same way. Offliner is intended to be used in [Chrome Canary](https://www.google.com/chrome/browser/canary.html?platform=win64) right now. If you are on Linux, try [Chrome Unstable](https://www.google.com/chrome/browser/desktop/index.html?platform=linux&extra=devchannel) instead. **Remember you need to [enable them](http://jakearchibald.com/2014/using-serviceworker-today/#in-canary-today) before using!**

Pay attention to the [progression of Service Workers implementations](https://jakearchibald.github.io/isserviceworkerready/) and [review the W3C draft](http://www.w3.org/TR/2014/WD-service-workers-20141118/) for more information.

## Usage
The only thing you need is to copy all files in this repository on your site's root and add this tag at the beginning of your `index.html` document:

```html
<script src="offline-cache-setup.js"></script>
```

Add the attribute `data-root` if your application is not in the root of your hosting. This is useful for `gh-pages` hosted apps.

```html
<script data-root="my-awesome-app" src="offline-cache-setup.js"></script>
```

## Configuring offliner

The file `cache.js` contains some useful variables you can customize if want to tweak offliner. See inside the file for more info but here you have a summary of each of them:

  * `NETWORK_ONLY`: it's an object with those things that never will be fetched from the cache as keys. Each key can be set to `true` or another URL to point a fallback if there is a network error.
  * `PREFETCH`: it's a list of URLs to be automatically fetched. The list accepts objects with some interesting properties. Set to the object `{ type: 'zip', url: '/an/url/to/a.zip' }`, _offliner_ will download the ZIP file and use the contents to prefetch everything. The ZIP should contain only those files you want to prefetch and the root must be the directory holding the application. Set to `{ type: 'gh-pages' }`, __offliner__ will use the packaged zip from the `gh-pages` branch of your project. Use it if your application is hosted under __gh-pages__.
  * `UPDATE`: stablishes the update policy. In case of update, the prefetch process is re-triggered. If set to false, no updating test is performed at all. If set to `{ type: 'gh-pages' }`, the hash of the `gh-pages` branch's HEAD commit is used.

## Whishlist

  * Wildcards for URLs.
  * Wait for service worker to be fully installed before entering the application via worker communication through `postMessage()`.
  * Timeout parameter to guarantee quality of service.
  * Declarative dependency graph to force all the members to be all together up to date.
  * Fine control about bustings.
  * Metadata through indexed DB.
  * ...[add yours](https://github.com/lodr/offliner/issues/new)!
