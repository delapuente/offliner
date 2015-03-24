YUI.add("yuidoc-meta", function(Y) {
   Y.YUIDoc = { meta: {
    "classes": [
        "FetchConfig",
        "Fetcher",
        "Offliner",
        "PrefetchConfig",
        "Resource",
        "SourceHandler",
        "UpdateConfig",
        "UpdateControl",
        "UpdateImplementation"
    ],
    "modules": [
        "fetchers",
        "sources",
        "updaters"
    ],
    "allModules": [
        {
            "displayName": "fetchers",
            "name": "fetchers",
            "description": "A collection of {{#crossLink \"Fetcher\"}}{{/crossLink}} constructors to\nconfigure offliner."
        },
        {
            "displayName": "sources",
            "name": "sources",
            "description": "A collection of {{#crossLink \"FetchSource\"}}{{/crossLink}} constructors to\nconfigure offliner."
        },
        {
            "displayName": "updaters",
            "name": "updaters",
            "description": "A collection of {{#crossLink \"UpdateImplementation\"}}{{/crossLink}}\nconstructors to configure offliner."
        }
    ]
} };
});