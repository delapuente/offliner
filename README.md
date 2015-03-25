
# Offliner
Offliner is a configurable [service worker](http://www.html5rocks.com/en/tutorials/service-worker/introduction/?redirect_from_locale=ja) that brings offline capabilities to your web applications.

## Remember

This technology can be used in the following browsers:
  * [Chrome](https://www.google.com/chrome/)
  * [Firefox Nightly](https://nightly.mozilla.org/)

Pay attention to the [progression of Service Workers implementations](https://jakearchibald.github.io/isserviceworkerready/) and [review the W3C draft](http://www.w3.org/TR/2014/WD-service-workers-20141118/) for more information.

## Demo

You have a documented demo in the `/demo` folder. Run

```bash
$ gulp webserver
```

And enter `demo/index.html` to see the demo in action. Try to shut the webserver down after visiting `index.html` and enter to some file explanation to make the **offliner** act.

## Writing the worker

When using **offliner** you still need to write the worker. The worker will configure **offliner** by using pseudo-declarative syntax.

Edit a file such as `offliner-worker.js`. Now instantiate a worker instance:

```js
importScripts('dist/offliner.min.js');
// import here the plug-ins for offliner

var offliner = new off.Offliner();
```

**Offliner** provides a generic lifecycle for web applications. To configure its installation, you use the [`prefetch API`](https://cdn.rawgit.com/lodr/offliner/concept/docs/classes/PrefetchConfig.html):

```js
offliner.prefetch
  .use(/* ... */) // you will find fetchers in the off.fetchers collection
  .resources([/* ... */]);
```

Prefetch happens only once in your application lifecycle, when the worker is installed for the first time. Prefetch process will populate an offline cache for serving files. How the web resources are served is configurable by using the [`fetch API`](https://cdn.rawgit.com/lodr/offliner/concept/docs/classes/FetchConfig.html):

```js
offliner.fetch
  .use(/* ... */) // you will find sources in the off.sources collection
  .use(/* ... */)
  .orFail();
```

Fetching is something that happens every time the web requires a resource.

Lastly, an update is triggered, at least, every time the worker is stopped and resumed later. To handle how the update should be performed, use the [`update API`](https://cdn.rawgit.com/lodr/offliner/concept/docs/classes/UpdateConfig.html):

```js
offliner.update
  .option('period', '5m') // set the update period
  .use(/* ... */) // you will find update strategies in the off.updaters collection
```

You have a [complete and running worker](https://github.com/lodr/offliner/blob/concept/demo/worker.js) inside the `/demo` folder with examples of fetchers, sources and an update strategy inside [`/demo/js`](https://github.com/lodr/offliner/tree/concept/demo/js).

### Running multiple instances of offliner

If you need more than one offliner instance or maybe you're trying different projects, all under localhost, you can pass a unique string to the constructor to avoid the persistent state of the workers to interfere.

```js
importScripts('dist/offliner.min.js');
var awesomeapp = new off.Offliner('myawesomeapp.com');
var terrificapp = new off.Offliner('myterrificapp.com');
```

## Installing the worker

The worker can be installed by including the `dist/offliner-setup.js` script. This way:

```html
<script src="dist/offliner-setup.js"></script>
```

Notice this will install a worker called `offliner-worker.js` which is expected to be at the root of your server. If this is not the case use `data-root` and `data-worker` to change the base directory where your worker is and the name of your worker. Remember the worker will be installed at `data-root`.

```html
<script src="dist/offliner-setup.js" data-root="demo" data-worker="worker.js"></script>
```

### Documentation

Read the complete (private and public interfaces) [documentation online](https://rawgit.com/lodr/offliner/concept/docs/index.html).

## Credits

The refactor of the API was inspired by [serviceworkerware](https://github.com/arcturus/serviceworkerware). We are providing a middleware mode as well.
