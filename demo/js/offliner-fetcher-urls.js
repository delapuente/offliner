
self.fetchers = self.fetchers || {};
self.fetchers.urls = {
  type: 'url',
  normalize: function (resource) {
    return { type: this.type, url: resource };
  },
  prefetch: function (resources, cache) {
    return Promise.all(resources.map(function (resource) {
      return fetch(resource.url).then(cache.put.bind(cache, resource.url));
    }));
  }
};
