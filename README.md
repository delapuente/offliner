
# Offliner
Offliner is a library for [service workers](http://www.html5rocks.com/en/tutorials/service-worker/introduction/?redirect_from_locale=ja) providing and lifecycle for your web applications.

## Remember

This technology can be used in the following browsers:
  * [Chrome](https://www.google.com/chrome/)
  * [Firefox Nightly](https://nightly.mozilla.org/)
  * [Firefox OS](https://developer.mozilla.org/en-US/Firefox_OS/Installing_on_a_mobile_device)

For Nightly and Firefox OS you need to [configure some things](https://blog.wanderview.com/blog/2015/03/24/service-workers-in-firefox-nightly/) before using.

Pay attention to the [progress of Service Workers implementations](https://jakearchibald.github.io/isserviceworkerready/) and [review the W3C draft](http://www.w3.org/TR/2014/WD-service-workers-20141118/) for more information.

## The Web App lifecycle

When you think about making your application to work offline you realize your web application has a life-cycle: you need it to get **installed**, then to be **served** and from time to time, to be **updated**. Offliner is a plugable framework to implement this life-cycle.

Install refers to make **all the resources available offline for the first time**. Serve means to **provide those resources** and update consists on **replacing the serving resources with newer versions**.

## Demo

You have a [documented demo](https://lodr.github.io/offliner) in the `/demo` folder. 

The problem with the link before is _GitHub_ changes the protocol to **http** as soon as you access the page and you need to change it again to **https** for the demo to work.

To run locally, type:

```bash
$ gulp webserver
```

And enter `demo/index.html` to see the demo in action. Try to shut the webserver down after visiting `index.html` and enter to some file explanation to make the **offliner** act.

## Registering the worker

The only thing you need in your web application code (apart of [writing the worker](#writing-the-worker), of course) is to add the `offliner-client.js` script:

```html
<script src="dist/offliner-client.js"></script>
```

Nothing happens yet. The script exports a global object `off` to communicate with the worker. Use `install()` to register the worker.

```html
<script src="dist/offliner-client.js"></script>
<script>
  off.install();
</script>
```

Notice calling [`off.install()`](https://rawgit.com/lodr/offliner/concept/docs/classes/OfflinerClient.html#method_install) will install a worker assuming it's called `offliner-worker.js` which is expected to be at the root of your server. If this is not the case use `data-root` and `data-worker` to change the base directory where your worker is and the name of your worker. Remember the worker will be registerd with `data-root` as scope so it will control all the resources under this path.

```html
<script src="dist/offliner-setup.js" data-root="demo" data-worker="worker.js"></script>
<script>
  off.install();
</script>
```

## Writing the worker

When using **offliner** you still need to write the worker. The worker will configure **offliner** by using pseudo-declarative syntax.

Edit a file such as `offliner-worker.js`. Now create an offliner instance:

```js
importScripts('dist/offliner.min.js');
// import here the plug-ins for offliner

var offliner = new off.Offliner();
```

### Installing your application

**Offliner** provides a generic lifecycle for web applications. To configure the installation, you use the [`prefetch API`](https://cdn.rawgit.com/lodr/offliner/concept/docs/classes/PrefetchConfig.html):

```js
offliner.prefetch
  .use(/* ... */) // you will find fetchers in the off.fetchers collection
  .resources([/* ... */]);
```

Prefetch happens only once in your application lifecycle, when the worker is installed for the first time. Prefetch process will populate an offline cache for serving files.

## GETing resources

How the web resources are served is configurable by using the [`fetch API`](https://cdn.rawgit.com/lodr/offliner/concept/docs/classes/FetchConfig.html):

```js
offliner.fetch
  .use(/* ... */) // you will find sources in the off.sources collection
  .use(/* ... */)
  .orFail();
```

Fetching is something that happens every time the web requires a resource.

## Updating the application

From time to time you will need to update your application. The update process is split into two:

  # Update
  # Activation

To update consists only in to get the latest available version, to check if an update is needed and finally to evolve the current cache to get an updated version. After an update **the offline cache remains the same**. This way we ensure that we are not serving different versions of mixed files without your consentment.

After an update, an [`activationPending`](https://rawgit.com/lodr/offliner/concept/docs/classes/OfflinerClient.html#event_activationPending) event is triggered in the [client](https://rawgit.com/lodr/offliner/concept/docs/classes/OfflinerClient.html). You can listen for this event to ask offliner to activate the new version. Commonly, after a successful activation, the web application reloads.

```html
<script src="dist/offliner-setup.js" data-root="demo" data-worker="worker.js"></script>
<script>
  off.install();
  off.on('activationPending', function () {
    off.activate().then(function () { window.location = window.location; });
  });
</script>
```

You can provide your own implementation for the update process by  using the [`update API`](https://cdn.rawgit.com/lodr/offliner/concept/docs/classes/UpdateConfig.html):

```js
offliner.update
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

### Documentation

Read the complete (private and public interfaces) [documentation online](https://rawgit.com/lodr/offliner/concept/docs/index.html).

## Credits

The refactor of the API was inspired by [serviceworkerware](https://github.com/arcturus/serviceworkerware). We are providing a middleware mode as well.
