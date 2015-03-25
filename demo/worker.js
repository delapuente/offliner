// First import the offliner library. This import exports the namespaces `off`
// to the global. `off` has three submodules, empty by default.
importScripts('../src/offliner.js');

// By convention, fetchers are put inside the `off.fetchers` submodule.
importScripts('./js/offliner-fetcher-urls.js');

// Sources are in the `off.sources` submodule.
importScripts('./js/offliner-source-cache.js');
importScripts('./js/offliner-source-network.js');

// And updaters in the `off.updaters` one.
importScripts('./js/offliner-updater-reinstall.js');

// You can create an offliner instance using `off.Offliner` as a constructor.
// If you want several instances of offliner, pass a unique name for each one
// in the constructor or the persistent state for each one could conflict.
offliner = new off.Offliner();

// Offliner provides with a configurable strategy to prefetch resources. Each
// resource is an object with a type and other data. Each fetcher has a type.
// Offliner gathers all the resources with the same type and feeds the fetcher
// with the matching type of those resources.
offliner.prefetch

  // You register a fetcher by calling `use()` with the fetcher.
  .use(off.fetchers.urls)

  // Then provide an array (you can pass a solely item as well) of resources
  // by using `resources()`. As you can see the resources **are not objects**,
  // if resources are not objects they are passed to the `normalize()` functions
  // of last fetcher `use()`d.
  .resources([
    './',
    './docco.css',
    './index.html',
    './js/offliner-fetcher-urls.js.html',
    './js/offliner-source-cache.js.html',
    './js/offliner-source-network.js.html',
    './js/offliner-updater-reinstall.js.html',
    './worker.js.html'
  ]);

// Offliner has a plugable fetch strategy based on fallbacks. When a resource
// is fetched, it traverse all the source pipeline until one is able to provide
// a response. If the source returns a rejected promise or throws an exception,
// the request pass to the next source until reaching the end of the pipeline.
offliner.fetch

  // You call `use()` to add a source to the pipeline.
  .use(off.sources.cache)

  // Order is important and so, `network` source will act if `cache` is not
  // able to answer the request.
  .use(off.sources.network)

  // You can use `orFail()` to quickly add an always failing strategy imitating
  // a network error but you are not restricted to this. You could return your
  // own custom 404 error o generate awesome error pages on the fly!
  .orFail();

// Last but not least, Offliner offers a generic update strategy. It is based
// on the following steps:
//
// 1. Get the latest version. [hook]
// 2. Determine if it is a new version. [hook]
// 3. Prepare a new offline cache.
// 4. Populate the new cache updating the old one. [hook]
// 5. After the service worker is stopped and before the next _first fetch_,
//    activate the new cache.
//
// As you can see, there are three [hook] marks indicating which steps can be
// customized. These steps must be provided by the update implementation.
offliner.update

  // You can customize some aspects of the update such as the period at the
  // update is triggered again. For period, you can use milliseconds, the
  // keywords `never` or `once` or an string using _s_, _m_ and _h_ as units
  // such as `'5m'` of `'6h'`.
  .option('period', 'once')

  // You call `use()` to register the update implementation providing the
  // convinient hooks. Calling use implies calling `option('enabled', true)`.
  .use(off.updaters.reinstall.onInstallOnly(true));

  // With `onInstallOnly(true)` you need to alter the worker to trigger
  // the update. Adding a comment will suffice. If you set it to `false`
  // the update process will be launched each 5 minutes with the current
  // configuration.

// Lastly, use `standalone()` to install offliner as a service worker. Other
// options will be soon available...
offliner.standalone();
