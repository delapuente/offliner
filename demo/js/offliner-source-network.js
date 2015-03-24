
self.sources = self.sources || {};
self.sources.network = function (request) {
  return fetch(request);
};
