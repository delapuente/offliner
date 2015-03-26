// **How to write an update implementation**

// Remember including offliner will export the `off` module with a namespace
// reserved for `updaters`. Put your update implementation inside.
self.off.updaters.reinstall = {

  // Should check for the latest version. It must return a promise resolving
  // with a version tag, which is a string representing the version.
  check: function () {
    // This case we always return a new version but in the real life. We could
    // ask a server for the latest version.
    return Promise.resolve('v' + Date.now());
  },

  // Should check if the version from the step above is a new version given the
  // current one. Notice **offliner** is not aware about the meaning of your
  // versions but you could write middleware understanding semver for instance.
  isNewVersion: function (current, latest) {
    // Let's avoid less-than-a-minute updates
    return parseInt(latest.substr(1)) > (parseInt(current.substr(1)) + 60000);
  },

  // Should implement how to update the current cache.
  evolve: function (previousCache, newCache, reinstall) {
    // The update process set some flags you can check in the `flags` property.
    // Flag `isCalledFromInstall` indicates the worker was already installed
    // but changed.
    if (!this.flags.isCalledFromInstall || this._onInstallOnly) {
      // The callback `reinstall` is provided to roughly trigger a prefetch
      // on the new cache. Several times, the only thing you need to update
      // is to reinstall all again.
      return reinstall();
    }
    return Promise.resolve();
  },

  // Of course you can provide as many extra functions as you need.
  onInstallOnly: function (isSet) {
    this._onInstallOnly = isSet;
    return this;
  }
};
