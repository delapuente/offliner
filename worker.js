
importScripts('offliner-lib/sources.js');
importScripts('offliner-lib/fetchers.js');
importScripts('offliner-lib/updaters.js');
importScripts('offliner-lib/offliner.js');

var base = (function () {
  var pathname = self.location.pathname;
  var tokens = pathname.split('/');
  tokens.pop();
  return tokens.join('/');
}());
var offliner = new Offliner();

var CACHE = [];
var NETWORK = [];
var FALLBACKS = {};
var FALLBACK_RESOURCES =
  Object.keys(FALLBACKS).map(function (key) { return FALLBACKS[key]; });

offliner.prefetch
  .use(fetchers.url({ base: base }))
  .resources(CACHE.concat(FALLBACK_RESOURCES));

offliner.update
  .use(updaters.prefetch({ onInstallOnly: true }));

offliner.fetch
  .use(sources.cache())
  .use(sources.network(NETWORK))
  .use(sources.fallback(FALLBACKS))
  .use(sources.network('*'))
  .orFail();

offliner.standalone();
