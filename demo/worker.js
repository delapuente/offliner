importScripts('../dist/offliner.min.js');
importScripts('./js/offliner-fetcher-urls.js');
importScripts('./js/offliner-source-cache.js');
importScripts('./js/offliner-source-network.js');

offliner = new Offliner();

offliner.prefetch
  .use(fetchers.urls)
  .resources(['./', './another.html', './credits.html']);

offliner.fetch
  .use(sources.cache)
  .use(sources.network)
  .orFail();

offliner.standalone();
