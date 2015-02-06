var CACHE_NAME = 'offliner-cache';

// Convenient shortcuts
['log', 'warn', 'error'].forEach(function (method) {
  self[method] = console[method].bind(console);
});

// The root pathname
var root = (function () {
  var currentPath = self.location.pathname;
  var tokens = currentPath.split('/');
  tokens.pop();
  var currentDir = tokens.join('/');
  return currentDir + '/';
}());

// Import plugins
importScripts('offliner-plugins/XMLHttpRequest.js');
importScripts('offliner-plugins/zip.js/zip.js'); // exports zip
importScripts('offliner-plugins/zip.js/zip-ext.js');
importScripts('offliner-plugins/zip.js/deflate.js');
importScripts('offliner-plugins/zip.js/inflate.js');
zip.useWebWorkers = false;


// Import the configuration file.
try {
  importScripts('cache.js');
}
catch (e) {
  var NETWORK_ONLY = {};
  var PREFETCH = [];
}

(function digestConfigFile() {
  var origin = self.location.origin;

  // Convert relative to global URLs.
  Object.keys(NETWORK_ONLY).forEach(function (url) {
    var fallback = NETWORK_ONLY[url];
    url = absoluteURL(url);
    if (typeof fallback === 'string') {
      NETWORK_ONLY[url] = absoluteURL(fallback);
    }
  });

  // Normalize prefetch
  if (PREFETCH && !Array.isArray(PREFETCH)) {
    PREFETCH = [PREFETCH];
  }
  else if (!PREFETCH) {
    PREFETCH = [];
  }
  PREFETCH = PREFETCH.map(function (option) {
    if (typeof option === 'object' && option.type === 'gh-pages') {
      option.type = 'zip';
      option.url = getZipURLFromGHPages(self.location);
      return option;
    }
    return option;
  });

  function getZipURLFromGHPages(url) {
    var username = url.host.split('.')[0];
    var repo = url.pathname.split('/')[1];
    return getZipFromGHData(username, repo, 'gh-pages');
  }

  function getZipFromGHData(username, repo, branch) {
    var path = [username, repo, 'zip', branch].join('/');
    return 'https://codeload.github.com/' + path;
  }
}());

function absoluteURL(url) {
  return new self.URL(url, self.location.origin).href;
}

function join() {
  var joint = '';
  for (var i = 0, path; (path = arguments[i]); i++) {
    var hasLeadingSlash = path[0] === '/';
    var hasTrailingSlash = path[path.length - 1] === '/';
    if (hasTrailingSlash) { path = path.substr(0, path.length - 1); }
    joint += hasLeadingSlash ? path : ('/' + path);
  }
  return joint;
}

function getMIMEType(filename) {
  var MIMEMap = {
    'css': 'text/css',
    'js': 'application/javascript',
    'html,html': 'text/html'
  };
  var items;
  var mimetype = 'undefined';
  var extensions = Object.keys(MIMEMap);
  for (var i = 0, list; (list = extensions[i]); i++) {
    mimetype = MIMEMap[list];
    items = list.split(',');
    for (var j = 0, extension; (extension = items[j]); j++) {
      if (RegExp('\\.' + extension + '$').test(filename)) {
        return mimetype;
      }
    }
  }
  return mimetype;
}

// On install, we perform the prefetch process
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.delete(CACHE_NAME)
      .then(prefetch)
      .then(function () {
        log('Offline cache installed at ' + new Date() + '!');
      })
      .catch(error)
  );
});

self.addEventListener('activate', function (event) {
  log('Offline cache activated at ' + new Date() + '!');
});

// Prefetch is the process to prepopulate the offline cache
function prefetch() {
  return cacheNetworkOnly().then(digestPreFetch);
}

// Caches the NETWORK_ONLY fallbacks
function cacheNetworkOnly() {
  return caches.open(CACHE_NAME).then(function (offlineCache) {
    return Promise.all(Object.keys(NETWORK_ONLY).map(function (url) {
      var promise;
      var fallback = NETWORK_ONLY[url];
      if (typeof fallback !== 'string') {
        promise = Promise.resolve();
      }
      else {
        var request = new Request(fallback, { mode: 'no-cors' });
        promise = fetch(request)
          .then(offlineCache.put.bind(offlineCache, request));
      }
      return promise;
    }));
  });
}

// Creates a chain of promises to populate the cache
// TODO: Add support for single files.
function digestPreFetch() {
  var digestion = Promise.resolve();
  PREFETCH.forEach(function (option) {
    if (typeof option === 'string') {
      var url = absoluteURL(option);
      populateFromURL(url);
    }
    else if (option.type === 'zip') {
      var zipURL = absoluteURL(option.url);
      digestion = digestion.then(function () {
        return populateFromRemoteZip(zipURL);
      });
    }
  });
  return digestion;
}

function populateFromURL(url) {
  return caches.open(CACHE_NAME).then(function (offlineCache) {
    var request = new Request(fetchingURL(url), { mode: 'no-cors' });
    return fetch(request).then(offlineCache.put.bind(offlineCache, request));
  });
}

// Fetch a remote ZIP, deflates it and add the routes to the cache
function populateFromRemoteZip(zipURL) {
  log('Populating from ' + zipURL);
  var readZip = new Promise(function (accept, reject) {
    zip.createReader(new zip.HttpReader(zipURL), function(reader) {
      reader.getEntries(function(entries) {
        deflateInCache(entries)
          .then(reader.close.bind(reader, null)) // avoid callback for close
          .then(accept);
      });
    }, function(error) {
      reject(error);
    });
  });
  return readZip;
}

// Decompress each zipped file and add it to the cache
function deflateInCache(entries) {
  return caches.open(CACHE_NAME).then(function (offlineCache) {
    var logProgress = getProgressLogger(entries);
    return Promise.all(entries.map(function deflateFile(entry) {
      var promise;
      if (entry.directory) {
        logProgress();
        promise = Promise.resolve();
      }
      else {
        promise = new Promise(function (accept) {
          entry.getData(new zip.BlobWriter(), function(content) {
            var filename = entry.filename;
            var headers = new Headers();
            headers.append('Content-Type', getMIMEType(filename));
            var response = new Response(content, { headers: headers });
            var url = absoluteURL(join(root, filename));
            offlineCache.put(url, response)
              .then(logProgress)
              .then(accept);
          });
        });
      }
      return promise;
    }));
  });

  function getProgressLogger(entries) {
    var total = entries.length;
    var completed = 0;
    return function progressLogger() {
      completed++;
      log('Caching at ' + Math.floor(100 * completed/total) + '%');
    };
  }
}

// Intercept requests to network.
self.addEventListener('fetch', function (event) {
  var request = event.request;
  event.respondWith(offlineResolver(request));
});

// Apply NETWORK_ONLY policy or do the best effort to keep resources always
// up to date.
function offlineResolver(request) {
  if (isNetworkOnly(request)) {
    return responseThroughNetworkOnly(request);
  }
  else {
    return doBestEffort(request);
  }
}

function isNetworkOnly(request) {
  return !!NETWORK_ONLY[request.url];
}

// Try to fetch from network, if no response go to the cache if there is a
// fallback resource or fails.
function responseThroughNetworkOnly(request) {
  return fetch(fetchingRequest(request)).catch(function () {
    var fallback = NETWORK_ONLY[request.url];
    if (typeof fallback === 'string') {
      return responseThroughCache(new Request(fallback, { mode: 'no-cors' }));
    }
  });
}

// Try to fetch from cache or fails.
function responseThroughCache(request) {
  return caches.open(CACHE_NAME).then(function (offlineCache) {
    return offlineCache.match(request).catch(function (error) {
      console.log(error);
    });
  });
}

// The best effort consists into try to fetch from remote. If possible, save
// into the cache. If not, retrieve from cache. If not even possible, it fails.
function doBestEffort(request) {
  return caches.open(CACHE_NAME).then(function (offlineCache) {
    var localRequest = offlineCache.match(request).catch(function (error) {
      console.log(error);
    });

    var remoteRequest = fetch(fetchingRequest(request))
      .then(function (remoteResponse) {
        offlineCache.put(request, remoteResponse.clone());
        return remoteResponse;
      });

    var bestEffort = remoteRequest.catch(function () {
      return localRequest;
    });
    return bestEffort;
  });
}

function fetchingRequest(request) {
  var newRequest = request.clone();
  newRequest.url = fetchingURL(request.url);
  return newRequest;
}

// Normalizes the url to be fetched.
function fetchingURL(url) {
  // XXX: No idea why we must not bust the root URL, but it works
  var tokens = new self.URL(url);
  if (tokens.host !== self.location.host) { return url; }
  return tokens.pathname !== '/' ? busted(tokens) : tokens.href;
}

// Bust the URL to avoid navigator cache.
function busted(tokens) {
  return tokens.href + (tokens.search ? '&' : '?') + '__b=' + Date.now();
}
