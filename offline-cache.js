var NO_VERSION = 'zero';

// Convenient shortcuts
['log', 'warn', 'error'].forEach(function (method) {
  self[method] = console[method].bind(console);
});

var ports = [];

self.addEventListener('message', function (message) {
  if (message.data === 'subscribe') {
    ports.push(message.ports[0]);
    log('Subscription message received!');
  }
});

function broadcast(data) {
  ports.forEach(function (port) {
    port.postMessage(data);
  });
}

// The root pathname
var root = (function () {
  var currentPath = self.location.pathname;
  var tokens = currentPath.split('/');
  tokens.pop();
  var currentDir = tokens.join('/');
  return currentDir + '/';
}());

// Import plugins
importScripts('offliner-plugins/asyncStorage.js');
importScripts('offliner-plugins/asyncStoragePromise.js'); // exports asyncStorage
importScripts('offliner-plugins/XMLHttpRequest.js');
importScripts('offliner-plugins/zip.js/zip.js'); // exports zip
importScripts('offliner-plugins/zip.js/deflate.js');
importScripts('offliner-plugins/zip.js/inflate.js');
zip.useWebWorkers = false;

var defaults = {
  'networkOnly': {},
  'prefetch': [],
  'update': false,
  'ghPagesTunnelServer': 'http://localhost:4000'
};

var configMap = {
  'NETWORK_ONLY': 'networkOnly',
  'PREFETCH': 'prefetch',
  'UPDATE': 'update',
  'GH_PAGES_TUNNEL_SERVER': 'ghPagesTunnelServer'
};

loadDefaults();

// Load default configuration.
function loadDefaults() {
  self.NETWORK_ONLY = defaults.networkOnly;
  self.PREFETCH = defaults.prefetch;
  self.UPDATE = defaults.update;
  self.GH_PAGES_TUNNEL_SERVER = defaults.ghPagesTunnelServer;
}

// Apply a configuration object.
function applyConfig(configuration) {
  for (var property in configMap) if (configMap.hasOwnProperty(property)) {
    var configProperty = configMap[property];
    self[property] = applyIfExist(configProperty, self[property]);
  }

  function applyIfExist(property, fallback) {
    if (configuration.hasOwnProperty(property)) {
      return configuration[property];
    }
    return fallback;
  }
}

// Gets the package for a given branch. Due to CORS, it need to be tunneled
// through a server with a more relaxed CORS policy.
function getZipFromGHData(username, repo, branch) {
  var path = ['archive', username, repo, branch].join('/');
  return GH_PAGES_TUNNEL_SERVER + path;
}

// Normalize any URL into an absolute URL.
function absoluteURL(url) {
  return new self.URL(url, self.location.origin).href;
}

// Join parts of the URL's filepath.
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

// Return MIME type according to the extension.
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

// On install, we perform a first update.
self.addEventListener('install', function (event) {
  event.waitUntil(
    update()
      .then(function () {
        log('Offline cache installed at ' + new Date() + '!');
      })
      .catch(error)
  );
});

self.addEventListener('activate', function (event) {
  log('Offline cache activated at ' + new Date() + '!');
});

// The update process consists into get the new version tag an repeat the
// prefetch process. Notice how update does not fetch any package, just query
// about the latest version of the software through an update channel.
function update() {
  // XXX: Only one update process is allowed at time.
  if (!self.updateProcess) {
    self.updateProcess = reloadCacheConfig()
      .then(digestConfig)
      .then(getLatestVersionNumber)
      .then(checkIfNewVersion)
      .then(function (newVersion) {
        if (newVersion) {
          return getCacheNameForVersion(newVersion)
            .then(caches.open.bind(caches))
            .then(prefetch)
            .then(swapCaches)
            .then(updateCurrentVersion);
        }
      })
      .then(endUpdateProcess)  // XXX:
      .catch(error)            //
      .then(endUpdateProcess); // equivalent to .finally();
  }
  return self.updateProcess;

  function endUpdateProcess() {
    self.updateProcess = null;
  }
}

function reloadCacheConfig() {
  var configURL = absoluteURL(join(root, 'cache.json'));
  var configRequest = new Request(configURL);
  return doBestEffort(configRequest).then(function (response) {
    if (response && response.status === 200) {
      return response.json().then(applyConfig);
    }
  });
}

function digestConfig() {
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
      var zipInfo = getZipInfoFromGHPages(self.location);
      option.type = 'zip';
      option.url = zipInfo.url;
      option.prefix = zipInfo.prefix;
      return option;
    }
    return option;
  });
  return Promise.resolve();
}

// Gets the package from the information available in a gh-pages location.
function getZipInfoFromGHPages(url) {
  var username = url.host.split('.')[0];
  var repo = url.pathname.split('/')[1];
  return {
    url: getZipFromGHData(username, repo, 'gh-pages'),
    prefix: repo + '-gh-pages/'
  };
}


// Gets the latest version tag through the update channel.
function getLatestVersionNumber() {
  var latestVersion;

  // Update channel is disabled, fallback to default version.
  if (!UPDATE) {
    latestVersion = Promise.resolve(NO_VERSION);
  }

  // Update channel is gh-pages, compare through the HEAD commit of that branch.
  else if (UPDATE.type === 'gh-pages') {
    var updateChannel = getZipInfoFromGHPages(self.location).url;
    latestVersion = fetch(updateChannel, { method: "HEAD" })
      .then(function (response) {
        // XXX: The hash is in the ETag header of the branch's ZIP.
        if (response.status === 200) {
          var newVersion = response.headers.get('ETag').replace(/"/g, '');
          return newVersion;
        }
        else {
          throw new Error('Bad status: ' + response.status);
        }
      })
      .catch(function (reason) {
        warn('Update channel is unreachable, aborting.');
        warn('Details: ', reason);
        return Promise.reject(new Error('Update channel unreachable'));
      });
  }

  // Not supported.
  else {
    latestVersion = Promise.reject(new Error("Update method not supported!"));
  }

  return latestVersion;
}

// A simple comparison between current version and the new one.
function checkIfNewVersion(remoteVersion) {
  return asyncStorage.get('current-version').then(function (localVersion) {
    if (!localVersion || remoteVersion && remoteVersion !== localVersion) {
      log('New version ' + remoteVersion + ' found!');
      if (localVersion) { log('Updating from version ' + localVersion); }
      else { log('First update'); }
      // Update next version after determining that an update is needed.
      return asyncStorage.set('next-version', remoteVersion)
        .then(function () { return remoteVersion; });
    }
    else {
      log('No update needed');
    }
    return null;
  });
}

// Return the CACHE name for a version given.
function getCacheNameForVersion(version) {
  return Promise.resolve('cache-' + version);
}

// Prefetch is the process to prepopulate the offline cache
function prefetch(targetCache) {
  return cacheNetworkOnly(targetCache)
    .then(digestPreFetch.bind(undefined, targetCache));
}

// Caches the NETWORK_ONLY fallbacks
function cacheNetworkOnly(offlineCache) {
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
}

// Creates a chain of promises to populate the cache
function digestPreFetch(targetCache) {
  var urls = [];
  var digestion = Promise.resolve();
  PREFETCH.forEach(function (option) {
    if (typeof option === 'string') {
      var url = absoluteURL(option);
      urls.push(url);
    }
    else if (option.type === 'zip') {
      var zipURL = absoluteURL(option.url);
      digestion = digestion.then(function () {
        return populateFromRemoteZip(zipURL, option.prefix, targetCache);
      });
    }
  });
  // TODO: Should we stablish some specific order between entries?
  digestion = digestion.then(function () {
    return populateFromURL(urls, targetCache);
  });
  return digestion;
}

// Uses dynamic information to open the active CACHE.
function openActiveCache(version) {
  return asyncStorage.get('active-cache').then(caches.open.bind(caches));
}

// Update the active cache and delete the former one.
function swapCaches() {
  return Promise.all([
    getCurrentCache(),
    getNextCache()
  ]).then(swap);

  function getCurrentCache() {
    return asyncStorage.get('active-cache');
  }

  function getNextCache() {
    return asyncStorage.get('next-version').then(getCacheNameForVersion);
  }

  function swap(names) {
    var currentCache = names[0],
        nextCache = names[1];
    return asyncStorage.set('active-cache', nextCache)
    .then(caches.delete.bind(caches, currentCache));
  }
}

// Updates the current version with next version.
function updateCurrentVersion() {
  return asyncStorage.get('next-version')
  .then(asyncStorage.set.bind(asyncStorage, 'current-version'));
}

// Get a list (or a solely item) of URLs and put into the cache passed.
function populateFromURL(urls, offlineCache) {
  urls = Array.isArray(urls) ? urls : [urls];
  return Promise.all(urls.map(function (url) {
    var request = new Request(fetchingURL(url), { mode: 'no-cors' });
    return fetch(request).then(offlineCache.put.bind(offlineCache, request));
  }));
}

// Fetch a remote ZIP, deflates it and add the routes to the cache
function populateFromRemoteZip(zipURL, prefixToStrip, targetCache) {
  log('Populating from ' + zipURL);
  prefixToStrip = prefixToStrip || '';
  var readZip = new Promise(function (accept, reject) {
    fetch(zipURL).then(function (response) {
      return response.blob();
    }).then(function (blob) {
      zip.createReader(new zip.BlobReader(blob), function(reader) {
        reader.getEntries(function(entries) {
          deflateInCache(entries, prefixToStrip, targetCache)
            .then(reader.close.bind(reader, null)) // avoid callback for close
            .then(accept);
        });
      }, function(error) {
        reject(error);
      });
    });
  });
  return readZip;
}

// Decompress each zipped file and add it to the cache
function deflateInCache(entries, prefixToStrip, offlineCache) {
  prefixToStrip = prefixToStrip || '';
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
          var filename = entry.filename.substr(prefixToStrip.length);
          var indexFinder = /\bindex.html?$/i;
          var isIndex = indexFinder.test(filename);
          var headers = new Headers();
          headers.append('Content-Type', getMIMEType(filename));
          var response = new Response(content, { headers: headers });
          var url = absoluteURL(join(root, filename));
          var putInCache = offlineCache.put(url, response);
          if (isIndex) {
            var rootURL = url.replace(indexFinder, '');
            var rootResponse = new Response(content, { headers: headers });
            putInCache.then(function () {
              return offlineCache.put(rootURL, rootResponse);
            });
          }
          putInCache.then(logProgress).then(accept);
        });
      });
    }
    return promise;
  }));

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
  update();
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
  return openActiveCache().then(function (offlineCache) {
    return offlineCache.match(request).catch(function (error) {
      console.log(error);
    });
  });
}

// The best effort consists into try to fetch from remote. If possible, save
// into the cache. If not, retrieve from cache. If not even possible, it fails.
function doBestEffort(request) {
  return openActiveCache().then(function (offlineCache) {
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
