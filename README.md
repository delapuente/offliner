
# Offliner
Offliner is a library that implements a lifecycle for web applications utilizing [service workers](http://www.html5rocks.com/en/tutorials/service-worker/introduction/?redirect_from_locale=ja). The primary goal of offliner is to enable developers to provide an offline experience for their applications and easily dispatch updates to users as needed.

#### Compatibility
Service workers are still a very new technology, which means the progress of implementation varies across platforms. As of June 25th, 2015, this technology can be used in the following browsers:
  * [Chrome](https://www.google.com/chrome/)
  * [Firefox Nightly](https://nightly.mozilla.org/)
  * [Firefox OS](https://developer.mozilla.org/en-US/Firefox_OS/Installing_on_a_mobile_device)

For Firefox OS you will need to [configure some things](https://blog.wanderview.com/blog/2015/03/24/service-workers-in-firefox-nightly/) before using.

Pay attention to the [progress of Service Workers implementations](https://jakearchibald.github.io/isserviceworkerready/) and [review the W3C draft](https://slightlyoff.github.io/ServiceWorker/spec/service_worker/) for more information. Ongoing discussions that may affect the implementation of service workers can be followed in [github issues](https://github.com/slightlyoff/ServiceWorker/issues).


#### Demo

There is a [documented demo](https://lodr.github.io/offliner) in the `/demo` folder. You will have to change the protocol to **https** in order for this demo link to work. (It automatically changes to **http** when you first access the link.)*

To run locally, clone this repo and run an `npm install` from the root directory. Then start a webserver with:

```bash
$ gulp webserver
```

Navigate to `demo/index.html` to see the demo in action. Shut the webserver down after visiting `index.html`, and you should see that you are still able to access the page offline.

If you edit one of the files (i.e. `/demo/js/offliner-fetcher-urls.js.html`) and restart the server, clicking the 'Check for updates' button will detect the new version, and allow you to download and activate the update.


## The Web App Lifecycle
Enabling an offline experience for your web application requires a few different steps that form the basis for an application lifecycle. This lifecycle consists of three distinct states:

* **Installing:** Occurs on a user's first visit to your application. The installation phase prepares your application to be persistent and available for offline interaction. In this stage, you are provided with an offline cache where you can define the resources that must be available in order to provide an offline experience. 

* **Serving:** Occurs on any subsequent usage or interaction with your web application. All of the resources for offlining have already been cached and are fetched each time a user returns to the app.

* **Updating:** Occurs when the developer iterates on the application and wants to push an updated version to users. The process for this stage occurs entails several steps:
  1. **Check** for an update - determine the latest version and see if an update is needed
  2. **Download** the update - populate a new cache to replace the current resources
  3. **Activate** the update - replace the current cache with the new cache populated in the download step

More information on how to implement this lifecycle with offliner is available below in the [Getting Started](#getting-started) section.


## Getting Started

### Registering the worker

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

Calling [`off.install()`](http://rawgit.com/lodr/offliner/concept/docs/classes/OfflinerClient.html#method_install) expects a worker called `offliner-worker.js` at the root of your server. If this is not the case use `data-root` and `data-worker` to change the base directory where your worker is and the name of your worker. Remember the worker will be registerd with `data-root` as scope so it will control all the resources under this path.

```html
<script src="dist/offliner-setup.js" data-root="demo" data-worker="worker.js"></script>
<script>
  off.install();
</script>
```


### Writing the worker

When using **offliner** you still need to write the worker. The worker will configure **offliner** by using pseudo-declarative syntax.

Edit a file such as `offliner-worker.js`. Now create an offliner instance:

```js
importScripts('dist/offliner.min.js');
// import here the plug-ins for offliner

var offliner = new off.Offliner();
```

### Implementing the application lifecycle
#### Installing
To configure the installation, you use the [`prefetch API`](http://cdn.rawgit.com/lodr/offliner/concept/docs/classes/PrefetchConfig.html):

```js
offliner.prefetch
  .use(/* ... */) // you will find fetchers in the off.fetchers collection
  .resources([/* ... */]);
```

Prefetch happens only once in your application lifecycle, when the worker is installed for the first time. Prefetch process will populate an offline cache for serving files.

#### Serving
How the web resources are served is configurable by using the [`fetch API`](http://cdn.rawgit.com/lodr/offliner/concept/docs/classes/FetchConfig.html):

```js
offliner.fetch
  .use(/* ... */) // you will find sources in the off.sources collection
  .use(/* ... */)
  .orFail();
```

Fetching is something that happens every time the web requires a resource.

#### Updating
From time to time you will need to update your application. The update process is split into three parts:

1. Checking if an update is needed
2. Downloading the update
3. Activating the update

An update will check the latest available version of your application against the currently installed version. If it is determined that an update is needed, offliner will evolve the current cache to create an updated version. It's important to note that after an update, **the offline cache remains the same**. This is to ensure that we are not serving different versions of mixed files without your consent.

After downloading an update, the [`activationPending`](http://rawgit.com/lodr/offliner/concept/docs/classes/OfflinerClient.html#event_activationPending) event is triggered in the [client](http://rawgit.com/lodr/offliner/concept/docs/classes/OfflinerClient.html). You can listen for this event to ask offliner to activate the new version. Commonly, after a successful activation, the web application reloads.

```html
<script src="dist/offliner-setup.js" data-root="demo" data-worker="worker.js"></script>
<script>
  off.install();
  off.on('activationPending', function () {
    off.activate().then(function () { window.location = window.location; });
  });
</script>
```

You can provide your own implementation for the update process by using the [`update API`](http://cdn.rawgit.com/lodr/offliner/concept/docs/classes/UpdateConfig.html):

```js
offliner.update
  .use(/* ... */) // you will find update strategies in the off.updaters collection
```

You have a [complete and running worker](https://github.com/lodr/offliner/blob/concept/demo/worker.js) inside the `/demo` folder with examples of fetchers, sources and an update strategy inside [`/demo/js`](https://github.com/lodr/offliner/tree/concept/demo/js).

## Additional ways to use Offliner
#### Running multiple instances of offliner

If you need more than one offliner instance or maybe you're trying different projects, all under localhost, you can pass a unique string to the constructor to avoid having the different workers interfere with eachother.

```js
importScripts('dist/offliner.min.js');
var awesomeapp = new off.Offliner('myawesomeapp.com');
var terrificapp = new off.Offliner('myterrificapp.com');
```

#### Using offliner as serviceworkerware middleware (experimental)

[serviceworkerware](https://github.com/arcturus/serviceworkerware) is an API to write your own wervice worker in a declarative fashion. It allows you to control the worker responses for any method, and does not force you to use an offline cache. It is designed to be extendable in the same fashion as the [express framework](http://expressjs.com/) in node. serviceworkerware is still being frequently iterated on, so compatibility cannot always be guaranteed at the moment.

offliner can be plugged in as an specific middleware for controlling offline availability and the update cycle.

For example, in the worker, you might write something like:

```js
importScripts('lib/sww.js');
importScripts('dist/offliner.js');

var worker = new self.ServiceWorkerWare();
/* now configure worker */

var offliner = new self.off.Offliner();
/* now configure offliner */

// And finally connect both. Don't call offliner.standalone() after calling
// offliner.asMiddleware() or it will throw an exception.
worker.use(offliner.asMiddleware());
```

In your client code, instead of calling `off.install()`, call `off.connect()` to avoid registering the worker again.

## Documentation

Read the complete (private and public interfaces) [documentation online](https://rawgit.com/lodr/offliner/concept/docs/index.html).

## Credits

The refactor of the API was inspired by [serviceworkerware](https://github.com/arcturus/serviceworkerware). We are providing a middleware mode as well.
