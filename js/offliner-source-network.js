// **How to write a network source**

// Remember including offliner will export the `off` module with a namespace
// reserved for `sources`. Put your source inside.

// A source is a function that will be passed with a request and the active
// offline cache. The source must return a promise resolving with the proper
// response or rejecting when response is not available.
self.off.sources.network = function (request) {

  // This case we simply redirect the request to the network.
  return fetch(request);
};
