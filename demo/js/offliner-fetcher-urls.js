// # How to write a fetcher
//
// Remember including offliner will export the `off` module with a namespace
// reserved for `fetchers`. Put your fetcher inside.
self.off.fetchers.url = {

  // Provide a type for your fetcher. All resources with the specified type
  // will be handled by your fetcher.
  type: 'url',

  // Provide a `normalize()` function if you want to provide a shortcut for
  // resources. This case we allow to simply pass a string and we normalize
  // it to a resource that can be handled by the `prefetch()` method.
  normalize: function (resource) {
    return { type: this.type, url: resource };
  },

  // The `prefetch()` is passed with a list of resources of the fetcher's type
  // and the cache to be populated. It must return a Promise resolving when
  // prefetching is done.
  prefetch: function (resources, cache) {
    return Promise.all(resources.map(function (resource) {
      return fetch(resource.url).then(cache.put.bind(cache, resource.url));
    }));
  }
};
