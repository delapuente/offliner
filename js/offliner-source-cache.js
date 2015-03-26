// **How to write an offline source**

// Remember including offliner will export the `off` module with a namespace
// reserved for `sources`. Put your source inside.

// A source is a function that will be passed with a request and the active
// offline cache. The source must return a promise resolving with the proper
// response or rejecting when response is not available.
self.off.sources.cache = function (request, activeCache) {
  return activeCache.match(request).then(function (response) {

    // Notice how we resolve with the response if there is a match in the
    // cache of reject otherwise.
    return response ? Promise.resolve(response) : Promise.reject();
  });
};
