
self.sources = self.sources || {};
self.sources.cache = function (request, activeCache) {
  return activeCache.match(request).then(function (response) {
    return response ? Promise.resolve(response) : Promise.reject();
  });
};
