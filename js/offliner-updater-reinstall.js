// **How to write an update implementation**

// Remember including offliner will export the `off` module with a namespace
// reserved for `updaters`. Put your update implementation inside.
self.off.updaters.reinstall = {

  // Should check for the latest version. It must return a promise resolving
  // with a version tag, which is a string representing the version.
  check: function () {
    // For this demo we are checking the hash of the HEAD of gh-pages branch
    // on GitHub. We will use the free GitHub API for that end.
    var ghInfo = this.getGHInfoFromGHPages(self.location);
    var path = [
      'repos', ghInfo.username, ghInfo.repo, 'commits', 'gh-pages'
    ].join('/');
    var updateChannel = 'https://api.github.com/' + path;

    // Once we know the API URL, simply fetch and extract the hash field from
    // the response.
    return fetch(updateChannel).then(function (response) {
      if (response.status === 200) {
        return response.json().then(function (body) {
          return Promise.resolve('v' + body.sha);
        });
      }
      else {
        throw new Error('Can not check for new version: ' + response.status);
      }
    });
  },

  // Should check if the version from the step above is a new version given the
  // current one. Notice **offliner** is not aware about the meaning of your
  // versions but you could write middleware understanding semver for instance.
  isNewVersion: function (current, latest) {
    // The update process set some flags you can check in the `flags` property.
    // Flag `isFirstUpdate` indicates the worker has triggered the update
    // strategy for the first time.
    return this.flags.isFirstUpdate ||
           // We have a new version every time the hash changes.
           current !== latest;
  },

  // Should implement how to update the current cache.
  evolve: function (previousCache, newCache, reinstall) {
    // The callback `reinstall` is provided to trigger a prefetch directly
    // on the new cache. Several times, the only thing you need to do in order
    // to update is to reinstall all again.
    return reinstall();
  },

  // Of course you can provide as many extra functions as you need.
  getGHInfoFromGHPages: function (url) {
    return {
      username: url.host.split('.')[0],
      repo: url.pathname.split('/')[1]
    };
  }
};
