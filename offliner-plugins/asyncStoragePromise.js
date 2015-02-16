(function (asyncStorage) {
  for (var method in this.asyncStorage) {
    var fn = asyncStorage[method];
    asyncStorage[method] = getPromiseBasedVersion(fn);
  }

  function getPromiseBasedVersion(fn) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      return new Promise(function (accept, reject) {
        args[Math.max(args.length, fn.length) - 1] = accept;
        fn.apply(asyncStorage, args);
      });
    };
  }

  asyncStorage.get = asyncStorage.getItem;
  asyncStorage.set = asyncStorage.setItem;
}(this.asyncStorage));
