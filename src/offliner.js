(function (self) {
  'use strict';

  ['log', 'warn', 'error'].forEach(function (method) {
    self[method] = console[method].bind(console);
  });

  var DEFAULT_VERSION = '$zero$';

  /**
   * @class UpdateControl
   * @private
   */

  /**
   * Indicates if updates are enabled.
   * @property enabled
   * @type boolean
   */

  /**
   * Set to `true` when the update has run once.
   * @property alreadyRunOnce
   * @type boolean
   */

  /**
   * Holds the reference to the timer for the next update.
   * @property intervalId
   * @type Number
   */

  /**
   * Holds the reference to the promise representing the currently running
   * update process.
   * @property inProgressProcess
   * @type Object
   */

  /**
   * Creates a new Offliner instance.
   * @param {String} - a unique name representing the offline handler. This
   * allow you to instantiate several offliners for the same or different
   * workers without causing collisions between the configuration and cache
   * names.
   *
   * @class Offliner
   */
  function Offliner(uniquename) {
    Object.defineProperty(this, '_uniquename', {
      get: function () { return uniquename ? uniquename + ':' : ''; }
    });

    /**
     * Prevent the worker to be installed twice.
     *
     * @type boolean
     * @property _isStarted
     * @private
     */
    this._isStarted = false;

    /**
     * The global update control.
     *
     * @type UpdateControl
     * @property _updateControl
     * @private
     */
    this._updateControl = {
      enabled: false,
      alreadyRunOnce: false,
      intervalId: null,
      inProgressProcess: null
    };

    /**
     * Set to `true` when the worker is waiting for the first fetch.
     *
     * @type Booleaan
     * @property _firstFetch
     * @private
     */
    this._firstFetch = true;

    /**
     * API to configure the fetching pipeline.
     *
     * @type FetchConfig
     * @property fetch
     */
    this.fetch = new FetchConfig();

    /**
     * API to configure the prefetch process.
     *
     * @type PrefetchConfig
     * @property prefetch
     */
    this.prefetch = new PrefetchConfig();

    /**
     * API to configure the update process.
     *
     * @type UpdateConfig
     * @property update
     */
    this.update = new UpdateConfig();
  }

  /**
   * Installs the service worker in stand-alone mode.
   * @method standalone
   */
  Offliner.prototype.standalone = function () {

    if (this._isStarted) { return; }

    self.addEventListener('install', function (e) {
      e.waitUntil(
        this._install()
          .then(function () { log('Offliner installed'); })
      );
    }.bind(this));

    self.addEventListener('activate', function (e) {
      e.waitUntil(
        this._activateNextCache()
          .then(function () { log('Offliner activated!'); })
      );
    }.bind(this));

    self.addEventListener('fetch', function (e)  {
      if (e.request.method !== 'GET') {
        e.respondWith(fetch(e.request));
      }
      else {
        if (this.update.option('enabled')) {
          this._schedulePeriodicUpdates();
        }
        e.respondWith(this._fetchAfterCacheActivation(e.request));
      }
    }.bind(this));

    this._isStarted = true;
  };

  /**
   * Gets a setting for the offliner handler.
   *
   * @method get
   * @param {String} key The setting to be retrieved.
   * @private
   */
  Offliner.prototype.get = function (key) {
    var configURL = this._getConfigURL(key);
    return caches.open('__offliner-config').then(function (cache) {
      return cache.match(configURL).then(function (response) {
        if (!response) { return Promise.resolve(null); }
        else { return response.json(); }
      });
    });
  };

  /**
   * Sets a setting for the offliner handler.
   *
   * @method set
   * @param {String} key The setting.
   * @param {any} value The value to be set.
   * @private
   */
  Offliner.prototype.set = function (key, value) {
    var configURL = this._getConfigURL(key);
    var response = new Response(JSON.stringify(value));
    return caches.open('__offliner-config').then(function (cache) {
      return cache.put(configURL, response);
    });
  };

  /**
   * Return a fake URL scheme for a setting.
   *
   * @method _getConfigURL
   * @param {String} key The setting.
   * @return a fake URL scheme for the setting.
   * @private
   */
  Offliner.prototype._getConfigURL = function (key) {
    return 'http://config/' + this._uniquename + key;
  };

  /**
   * Install the timers for periodic updates.
   *
   * @method _schedulePeriodicUpdates
   * @param {Boolean} fromInstall Indicates if the call comes from the
   * {{#crossLink "Offliner/_install:method"}}{{/crossLink}} method.
   * @private
   */
  Offliner.prototype._schedulePeriodicUpdates = function (fromInstall) {
    if (!this._updateControl.enabled) {
      if (!this._updateControl.alreadyRunOnce &&
          !this._updateControl.inProgressProcess) {
        log('SW awake update.');
        this._update(fromInstall);
      }
      var updatePeriod = offliner.update.option('period');
      if (typeof updatePeriod === 'string') {
        var unit = updatePeriod[updatePeriod.length - 1];
        var number = parseFloat(updatePeriod);
        var milliseconds = this._convertToMilliseconds(number, unit);
      }
      if (typeof updatePeriod === 'number' ) {
        log('Next update in', updatePeriod / 1000, 'seconds.');
        this._updateControl.intervalId = setInterval(function () {
          log('Periodic update. Next in', updatePeriod / 1000, 'seconds.');
          this._update();
        }.bind(this), updatePeriod);
      }
      this._updateControl.enabled = true;
    }
  };

  /**
   * Convert to milliseconds given a unit.
   *
   * @method _convertToMilliseconds
   * @param {Number} value Number to be converted.
   * @param {String} unit Can be `s`, `m` and `h`. If not recognized, no
   * conversion is done.
   * @return {Number} milliseconds for the given amount.
   */
  Offliner.prototype._convertToMilliseconds = function (value, unit) {
    var ratios = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000 };
    var ratio = ratios[unit];
    if (!ratio) { ratio = 1; }
    return value * ratio;
  };

  /**
   * Determine if the worker should prefetch or update after (re)installing the
   * service worker.
   *
   * @method _install
   * @private
   */
  Offliner.prototype._install = function () {
    var fromInstall = true;
    return this.get('current-version').then(function (currentVersion) {
      var isUpdateEnabled = this.update.option('enabled');
      if (currentVersion) {
        return isUpdateEnabled ?
               this._schedulePeriodicUpdates(fromInstall) : Promise.resolve();
      }
      return this._initialize().then(this._prefetch.bind(this));
    }.bind(this), error);
  };

  /**
   * Initializes the current version and active cache for the first time.
   *
   * @method _initialize
   * @private
   */
  Offliner.prototype._initialize = function () {
    return this._getCacheNameForVersion(DEFAULT_VERSION)
      .then(this.set.bind(this, 'active-cache'))
      .then(this.set.bind(this, 'current-version', DEFAULT_VERSION));
  };

  /**
   * Performs a generic update process. It consists into:
   *
   *   1. Check for a new version using a middleware.
   *   2. Prepare the new version database.
   *   3. Evolve the offline cache using the middleware.
   *   4. Clean-up.
   *
   * @method _update
   * @param {Boolean} fromInstall Indicates if the call comes from the
   * {{#crossLink "Offliner/_install:method"}}{{/crossLink}} method.
   *  @private
   */
  Offliner.prototype._update = function (fromInstall) {
    // XXX: Only one update process is allowed at a time.
    var that = this;
    if (!this._updateControl.inProgressProcess) {
      this.update.flags = { isCalledFromInstall: fromInstall };
      this._updateControl.inProgressProcess = this._getLatestVersion()
        .then(this._checkIfNewVersion.bind(this))
        .then(updateCache)
        .then(endUpdateProcess)  // XXX:
        .catch(error)            //
        .then(endUpdateProcess); // equivalent to .finally();
    }
    return this._updateControl.inProgressProcess;

    function updateCache(newVersion) {
      if (newVersion) {
        return that._getCacheNameForVersion(newVersion)
          .then(caches.open.bind(caches))
          .then(that._evolveCache.bind(that));
      }
    }

    function endUpdateProcess() {
      that._updateControl.alreadyRunOnce = true;
      that._updateControl.inProgressProcess = null;
    }
  };

  /**
   * Return the CACHE name for a version given.
   *
   * @method _getCacheNameForVersion
   * @param {String} version The version to calculate the name for.
   * @return {Promise<String>} A promise resolving with the name for the
   * version.
   * @private
   */
  Offliner.prototype._getCacheNameForVersion = function (version) {
    return Promise.resolve(this._uniquename + 'cache-' + version);
  };

  /**
   * Opens current active cache and starts prefetch.
   *
   * @method _prefetch
   * @private
   */
  Offliner.prototype._prefetch = function () {
    return this._openActiveCache().then(this._doPrefetch.bind(this));
  };

  /**
   * Processes prefetch declared resources using the registered middlewares.
   *
   * @method _doPrefetch
   * @param {Cache} cache The cache for the middlewares to populate.
   * @private
   */
  Offliner.prototype._doPrefetch = function (cache) {
    var allResources = this.prefetch.resources();
    var fetchers = this.prefetch.fetchers();
    var resourcesByType = groupResources(fetchers, allResources);
    return fetchers.reduce(function (process, fetcher) {
      return process.then(function () {
        var resources = resourcesByType[fetcher.type];
        return fetcher.prefetch(resources, cache);
      });
    }, Promise.resolve());

    function groupResources(fetchers, resources) {
      var resourceGatherers = fetchers.reduce(function (gatherers, fetcher) {
        gatherers[fetcher.type] = [];
        return gatherers;
      }, {});
      resources.forEach(function (resource) {
        var resourcesByType = resourceGatherers[resource.type];
        if (resourcesByType) { resourcesByType.push(resource); }
      });
      return resourceGatherers;
    }
  };

  /**
   * Obtains the latest version using the update middleware.
   *
   * @method _getLatestVersion
   * @return {Promise<String>} Tag representing the latest version. The tag will
   * be used as suffix for the new cache.
   * @private
   */
  Offliner.prototype._getLatestVersion = function () {
    return this.update.check();
  };

  /**
   * Determine if there is a new version based on the latest version and the
   * current one by using the update middleware.
   *
   * @method _checkIfNewVersion
   * @return {Promise<String>} remoteVersion The new version tag is returned
   * if there is a new version or `null` otherwise.
   * @private
   */
  Offliner.prototype._checkIfNewVersion = function (remoteVersion) {
    return this.get('current-version').then(function (localVersion) {
      var isNewVersion =
        this.update.isNewVersion(localVersion, remoteVersion);

      if (isNewVersion) {
        log('New version ' + remoteVersion + ' found!');
        if (localVersion) { log('Updating from version ' + localVersion); }
        else { log('First update'); }

        return this.set('next-version', remoteVersion)
          .then(function () { return remoteVersion; });
      }
      else {
        log('No update needed');
      }
      return null;
    }.bind(this));
  };

  /**
   * Evolves the current cache to the new cache by using the update middleware.
   *
   * @method _evolveCache
   * @param {Cache} newCache The new cache.
   * @private
   */
  Offliner.prototype._evolveCache = function (newCache) {
    return this._openActiveCache().then(function (currentCache) {
      var exportedPrefetch = this._doPrefetch.bind(this, newCache);
      return this.update.evolve(currentCache, newCache, exportedPrefetch);
    }.bind(this));
  };

  /**
   * Uses dynamic information to open the active CACHE.
   *
   * @method _openActiveCache
   * @return {Promise<Cache>} A promise resolving to the active cache.
   * @private
   */
  Offliner.prototype._openActiveCache = function () {
    return this.get('active-cache').then(caches.open.bind(caches));
  };

  /**
   * Change the active cache to be the evolved cache if available. Once the
   * active cache has been updated, the former one is lost.
   *
   * @method _activateNextCache
   * @private
   */
  Offliner.prototype._activateNextCache = function () {
    return Promise.all([
      this.get('current-version'),
      this.get('next-version')
    ])
    .then(function (versions) {
      var currentVersion = versions[0];
      var nextVersion = versions[1];
      if (nextVersion && currentVersion !== nextVersion) {
        return this._swapCaches().then(this._updateCurrentVersion.bind(this));
      }
    }.bind(this));
  };

  /**
   * Makes active cache to be the next-version cache populated during a past
   * update process. After swapping, the previous cache is lost.
   *
   * @method _swapCaches
   * @private
   */
  Offliner.prototype._swapCaches = function () {
    var that = this;
    return Promise.all([
      getCurrentCache(),
      getNextCache()
    ]).then(swap.bind(this));

    function getCurrentCache() {
      return that.get('active-cache');
    }

    function getNextCache() {
      return that.get('next-version')
        .then(that._getCacheNameForVersion.bind(that));
    }

    function swap(names) {
      var currentCache = names[0],
          nextCache = names[1];
      return that.set('active-cache', nextCache)
        .then(caches.delete.bind(caches, currentCache));
    }
  };

  /**
   * Updates the current version.
   *
   * @method _updateCurrentVersion
   * @private
   */
  Offliner.prototype._updateCurrentVersion = function () {
    return this.get('next-version')
      .then(this.set.bind(this, 'current-version'));
  };

  /**
   * Before serving anything from cache, this method emulates an activation
   * and triggers {{#crossLink "Offliner/_activateNextCache:method"}}
   * {{/crossLink}} to convert the evolved into the current active cache.
   *
   * Notice the evolved cache was created in a previous update process, now
   * is ready but it did not replace yet the active cache.
   *
   * @method _fetchAfterCacheActivation
   * @param {Request} request The request to be fetched.
   * @private
   */
  Offliner.prototype._fetchAfterCacheActivation = function (request) {
    if (this._firstFetch) {
      this._firstFetch = false;
      return this._activateNextCache()
        .then(this._fetch.bind(this, request))
        .catch(error);
    }
    return this._fetch(request);
  };

  /**
   * Use configured middlewares to perform the fetch process.
   *
   * @method _fetch
   * @param {Request} request The request to be fetched.
   * @private
   */
  Offliner.prototype._fetch = function (request) {
    return new Promise(function (resolve, reject) {
      this._openActiveCache().then(function (cache) {
        var sources = this.fetch.pipeline();
        trySources(sources);

        function trySources(sources, from) {
          from = from || 0;
          var sourcesCount = sources.length;
          if (from === sources.length) { reject(); }
          else {
            sources[from](request, cache).then(resolve, function () {
              trySources(sources, from + 1);
            });
          }
        }
      }.bind(this));
    }.bind(this));
  };

  /**
   * A resource is an object with a type and other fields to be retrieved by
   * the {{#crossLink "Fetcher"}}{{/crossLink}} with the same type.
   * @class Resource
   */

  /**
   * The type to associate the resource with an specific
   * {{#crossLink "Fetcher"}}{{/crossLink}}.
   *
   * @property type
   * @type String
   * @readonly
   */

  /**
   * A fetcher is an object for handling resouces during the prefetching
   * prefetch process. A fetcher must include a `type` and normalize and
   * prefetch implementations.
   *
   * @class Fetcher
   * @private
   */

  /**
   * While prefetching resources, each resource has a `type`. The resource
   * is handled by the fetcher whose `type` match it.
   *
   * @property type
   * @type String
   * @readonly
   */

  /**
   * Normalizes a resource not following the {{#crossLink Resource}}
   * {{/crossLink}} convention.
   *
   * @method normalize
   * @param {any} resource The denormalized resource.
   */

  /**
   * Retrieve a set of resources.
   *
   * @method prefetch
   * @param {Resource[]} resource The denormalized resource.
   * @param {Cache} cache The cache to populate.
   */

  /**
   * Prefetch process consists into recovering from the Web those
   * resources configured in offliner. To do so, you call
   * {{#crossLink "PrefetchConfig/use:method"}}{{/crossLink}}, then list the
   * resources by calling {{#crossLink "PrefetchConfig/resources:method"}}
   * {{/crossLink}}.
   *
   * @class PrefetchConfig
   */
  function PrefetchConfig() {
    this._resourceFetchers = {};
    this._resources = [];
  }

  /**
   * Register a {{#crossLink Fetcher}}{{/crossLink}}. The fetcher will be used
   * to retrieve the resources of the fetcher's type.
   *
   * @method use
   * @param {Fetcher} fetcher The fetcher to be used for resources of fetcher's
   * type.
   * @chainable
   */
  PrefetchConfig.prototype.use = function (fetcher) {
    this._resourceFetchers[fetcher.type] = fetcher;
    this._activeFetcher = fetcher;
    return this;
  };

  /**
   * Add resources to the prefetch list of resources.
   *
   * @method resources
   * @param {Resource|Resource[]} resources The list of resources to be added.
   * Each resource in the list is normalized by the last registered fetcher so
   * some fetchers allows a short syntax for its resources.
   * @chainable
   */
  PrefetchConfig.prototype.resources = function (resources) {
    if (arguments.length === 0) { return this._resources; }

    if (!Array.isArray(resources)) { resources = [resources]; }
    for (var i = 0, resource; (resource = resources[i]); i++) {
      var normalized;
      if (typeof resource !== 'object' || !resource || !resource.type) {
        try {
          normalized = this._activeFetcher.normalize(resource);
        }
        catch (e) {}
      }
      if (!normalized) {
        warn(resource, 'can not be normalized by', this._activeFetcher.type);
      }
      else {
        this._resources.push(normalized);
      }
    }
    return this;
  };

  /**
   * @method fetchers
   * @return {Fetcher[]} the registered fetchers.
   */
  PrefetchConfig.prototype.fetchers = function () {
    return Object.keys(this._resourceFetchers).map(function (type) {
      return this._resourceFetchers[type];
    }.bind(this));
  };

  /**
   * An object implementing methods to check for new version and update the
   * activate cache.
   *
   * @class UpdateImplementation
   */

  /**
   * Checks for a new version.
   *
   * @method check
   * @return {Promise<String>} A promise resolving in the new version.
   */

  /**
   * Determines if the checked new version is actually a new version.
   *
   * @method isNewVersion
   * @param {String} currentVersion The current version.
   * @param {String} latestVersion The version from
   * {{#crossLink "UpdateImplementation/check:method"}}{{/crossLink}}.
   * @return {Promise<String>} A promise resolving to a non empty string if
   * `latestVersion` is new compared to `currentVersion` or a `falsy` if not.
   * The string must be different from `currentVersion`.
   */

  /**
   * Populate the updated cache.
   *
   * @method evolve
   * @param {Cache} currentCache The current active cache. **Do not modify this
   * cache!**
   * @param {Cache} nextCache The cache to be populated.
   * @param {Function} reinstall A function to trigger the prefetch process. Some
   * update algorithms just want to prefetch again.
   * @return {Promise} A promise resolving after finishing the update process.
   * If you simply wants to simply reinstall, return the value from `reinstall`
   * invocation.
   */

  /**
   * Update consists into determine if there is a new version and
   * then evolve the current cache to be up to date. To register an update
   * algorithm you provide a {{#crossLink "UpdateImplementation"}}
   * {{/crossLink}} instance by using {{#crossLink "UpdateConfig/use:method"}}
   * {{/crossLink}}.
   *
   * @class UpdateConfig
   */
  function UpdateConfig() {
    this._options = {};
  }

  /**
   * Gets or set an option.
   *
   * @method option
   * @param {String} optname The name of the option to be set or get.
   * @param {any} [value] If provided, the value to be set for the passed option.
   * @chainable
   * @return {any} The value of the option when getting.
   */
  UpdateConfig.prototype.option = function (optname, value) {
    if (arguments.length === 2) {
      this._options[optname] = value;
      return this;
    }
    if (arguments.length === 1) {
      return this._options[optname];
    }
  };

  /**
   * Register the update implementation.
   *
   * @method use
   * @param {UpdateImplementation} impl The update implementation to be used.
   * @chainable
   */
  UpdateConfig.prototype.use = function (impl) {
    this.option('enabled', true);
    this._impl = impl;
    return this;
  };

  /**
   * Flags set at the beginning of the update process. They include:
   *
   * @property flags
   * @type UpdateFlags
   */
  Object.defineProperty(UpdateConfig.prototype, 'flags', {
    set: function (value) {
      this._impl.flags = value;
    },
    get: function () {
      return this._impl.flags;
    }
  });

  /**
   * Triggers the {{#crossLink "UpdateImplementation/check:method"}}
   * {{/crossLink}} algorithm of the registered update implementation.
   *
   * @method check
   */
  UpdateConfig.prototype.check = function () {
    return this._impl.check();
  };

  /**
   * Calls the {{#crossLink "UpdateImplementation/isNewVersion:method"}}
   * {{/crossLink}} check of the registered update implementation.
   *
   * @method isNewVersion
   */
  UpdateConfig.prototype.isNewVersion = function (localVersion, remoteVersion) {
    return this._impl.isNewVersion(localVersion, remoteVersion);
  };

  /**
   * Performs the {{#crossLink "UpdateImplementation/evolve:method"}}
   * {{/crossLink}} process of the registered update implementation.
   *
   * @method evolve
   */
  UpdateConfig.prototype.evolve = function (currentCache, newCache, prefetch) {
    return this._impl.evolve(currentCache, newCache, prefetch);
  };

  /**
   * A source handler is a **function** that accepts a request and the
   * active cache and return a Promise resolving into the proper Response. It's
   * used with {{#crossLink "FetchConfig/use:method"}}{{/crossLink}} of
   * {{#crossLink "FetchConfig"}}{{/crossLink}}.
   *
   * `sourceHandler(request, activeCache)`
   *
   * @class SourceHandler
   */

  /**
   * The fetch process consists into pass the request along a list
   * of source handlers. You call {{#crossLink "FetchConfig/use:method"}}
   * {{/crossLink}} to add a new source handler to the pipeline.
   *
   * @class FetchConfig
   */
  function FetchConfig() {
    this._pipeline = [];
  }

  /**
   * Adds a new {{#crossLink "SourceHandler"}}{{/crossLink}} to the fetching
   * pipeline.
   *
   * @method use
   * @param {SourceHandler} source The handler to be added to the pipeline.
   * @chainable
   */
  FetchConfig.prototype.use = function (source) {
    this._pipeline.push(source);
    return this;
  };

  /**
   * Gets the current pipeline of sources.
   *
   * @method pipeline
   * @return {SourceHandler[]} The current pipeline of source handlers.
   */
  FetchConfig.prototype.pipeline = function () {
    return this._pipeline;
  };

  /**
   * Adds an always failing source handler to the pipeline.
   *
   * @method orFail
   */
  FetchConfig.prototype.orFail = function () {
    this.use(function () {
      return Promise.reject(new Error('End of fetch pipeline!'));
    });
  };

  /**
   * The exported module for offliner.
   * @module off
   */
  self.off = {};

  self.off.Offliner = Offliner;

  /**
   * A collection of {{#crossLink "SourceHandler"}}{{/crossLink}}
   * constructors to configure offliner.
   * @submodule sources
   */
  self.off.sources = {};

  /**
   * A collection of {{#crossLink "Fetcher"}}{{/crossLink}} constructors to
   * configure offliner.
   * @submodule fetchers
   */
  self.off.fetchers = {};

  /**
   * A collection of {{#crossLink "UpdateImplementation"}}{{/crossLink}}
   * constructors to configure offliner.
   * @submodule updaters
   */
  self.off.updaters = {};

}(typeof self === 'undefined' ? this : self));

