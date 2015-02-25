
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

**Default**: `{}`

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

**Default**: `[]`

List with resources to be prefetched. Each item can be an URL or an object. If it is an URL, it can be absolute or relative and the resource in that URL will be stored in the offline cache during the worker installation.

Examples:

```js
"prefetch": [
  "/about.html",
  "https://fonts.googleapis.com/css?family=Montserrat:700",
  "https://fonts.googleapis.com/css?family=Open+Sans:400,700,400italic,700italic"
]
```

Supposing you're website is served under `http://mydomain.com`, the Service Worker will populate the cache with `http://mydomain.com/about.html` at the moment of installation or due to an update.

#### Prefetching from ZIP files

You can prefetch a large number of resources be packing all of them in a ZIP file and adding the package to the prefetch list as follows:

```js
"prefetch": [
  { "type": "zip", "url": "http://mydomain.com/app.zip" },
  ...
]
```

The files packaged in the zip are suposed to be relative to the same root as the service worker. If, for some reason, the ZIP file packages a directory (i.e it does not package `/index.html` but `/src/index.html`) use the property `prefix` to strip it out.

```js
"prefetch": [
  { "type": "zip", "url": "http://mydomain.com/app.zip", "prefix": "src" },
  ...
]
```

#### Autopacking with gh-pages

If you host your application in GitHub by using the `gh-pages` branch, you can use the special item:

```js
"prefetch": { "type": "gh-pages" }
```

To ask GiHub for a packaged version of your gh-pages branch.

This is roughly equivalen to:

```js
"prefetch": { "type": "zip", "url": "https://api.github.com/<user>/<repo>/zipfile/gh-pages", "prefix": "gh-pages-<repo>/" }
```

### update

**Default**: `false`

URL with the latest version. Updates using **offliner** are quite strighforward, an update is triggered each time the contents of the URL change with respect to the current version. The update process simply repeat the prefetch again.

Examples:

```js
"update": "http://mydomain.com/versions/latest"
```

Supposing your current version is `"v1.5.7"` and the URL answers with `"v1.6.2"`, an update is triggered and the prefetch process takes place again. Notice **offliner has no idea about what are the semantics** of the version and just compare the current version with the last one as pure text.

#### Always up-to-date with GitHub and gh-pages

It's quite usual for web apps to be hosted in a GitHub repository which offer a competent static server under the URL `https://user.github.io/project` with the contents of the `gh-pages` branch. Offliner provides partial integration with `gh-pages` considering the contents of this branch the most updated version of the application.

To integrate with `gh-pages` configure `update` as follows:

```js
"update": { "type": "gh-pages" }
```

This will read the unique hash at the HEAD of the `gh-pages` branch and trigger an update each time it changes. Remember that updating is independent of what to be updated. To complete integration with `gh-pages`, use the special `prefetch` item for `gh-pages` as well (see a little bit above).

### updatePeriod

**Default**: `"once"`

Determine the period at which new updates are checked. Possible values are:

  * **Numbers** express time in milliseconds.
  * **Reserved words** as `once` meaning once each time the service worker is activated.
  * **Special time string** formed by a number and one of the suffixes `h`, `m` or `s` meaning hours, minutes or seconds respectively.

Examples:

```js
"updatePeriod": "30m"
```

Will check for an update each 30 minutes.
  
  > It's impportant to notice that querying GitHub API for non authenticated origins has a restriction of 60 queries per hour so try to not set an update period too low.

### corsProxy

**Default**: `"http://crossorigin.me"`

Due to CORS restrictions, it is not possible to access the contents of the ZIP package downloaded from `codeload.github.com` so this URL points to a free Internet service to enable CORS from any origin. The service hosted at [`crossorigin.me` can be found on GitHub](https://github.com/technoboy10/crossorigin.me) and you can deploy your own if you are generating a lot of traffic or your package is quite big but this should suffice for testing purposes.

CORS proxies URL must follow the same API than `crossorigin.me`. This is to accept the target URL as the URL's path. I.e, for the default proxy, the request for My Awesome App `gh-pages` ZIP is:

```bash
http://crossorigin.me/https://codeload.github.com/lodr/my-awesome-app/zip/gh-pages
```

  > I hope I will convince GitHub to enable CORS in `codeload.github.com` to allow origins on `*.github.io` to access content but meanwhile this does the trick.

## Whishlist

  * Wildcards for URLs.
  * Wait for service worker to be fully installed before entering the application via worker communication through `postMessage()`.
  * Timeout parameter to guarantee quality of service.
  * Declarative dependency graph to force all the members to be all together up to date.
  * Fine control about bustings.
  * Metadata through indexed DB.
  * ...[add yours](https://github.com/lodr/offliner/issues/new)!
