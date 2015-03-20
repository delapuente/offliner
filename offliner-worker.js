
importScripts('offliner-libs/offliner.js');
importScripts('offliner-libs/sources.js');

var offliner = new Offliner();

offliner.prefetch.resources([]);
offliner.update.option('enabled', false);
offliner.fetch
  .use(sources.cache)
  .use(sources.network('*'))
  .use(sources.fallback())
  .orFail();

offliner.standalone();
