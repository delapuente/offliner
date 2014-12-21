
# Offliner
Offliner is a proof of concept about bringing offline web applications through [service workers](http://www.html5rocks.com/en/tutorials/service-worker/introduction/?redirect_from_locale=ja).

Service workers allows the developer to intercept resource requests to the network and take control of the fetching process. In addition with caches, service workers enable the Web to success where AppCache failed.

Offliner is a project aimed to provide a service worker intended to be as transparent and automatic as possible while keeping a lot of customization power. It tries to always fetch from network and fallbacks to cache when remote resource are unreachable for any reason. Try it now!

## Before using

Please, be aware about this technology is only available in some few browsers and not all the implementations behave the same way. Offliner is intended to be used in [Chrome Canary](https://www.google.com/chrome/browser/canary.html?platform=win64) right now. If you are on Linux, try [Chrome Unsatble](https://www.google.com/chrome/browser/desktop/index.html?platform=linux&extra=devchannel) instead. **Remeber you need to [enable them](http://jakearchibald.com/2014/using-serviceworker-today/#in-canary-today) before using!**

Pay attention to the [progression of Service Workers implementations](https://jakearchibald.github.io/isserviceworkerready/) and [review the W3C draft](http://www.w3.org/TR/2014/WD-service-workers-20141118/) for more information.

## Usage
The only thing you need is to copy all `*.js` files on your site's root and add this tag at the beginning of your `index.html` document:

```html
<script src="offline-cache-setup.js"></script>
```

## Whishlist

  * Wildcards for URLs.
  * Wait for service worker to be fully installed before entering the application via worker communication through `postMessage()`.
  * Timeout parameter to guarantee quality of service.
  * Declarative dependency graph to force all the members to be all together up to date.
  * Fine control about bustings.
  * Metadata through indexed DB.
  * ...[add yours](https://github.com/lodr/offliner/issues)!
