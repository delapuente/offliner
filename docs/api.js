YUI.add("yuidoc-meta", function(Y) {
   Y.YUIDoc = { meta: {
    "classes": [
        "FetchConfig",
        "Fetcher",
        "Offliner",
        "OfflinerClient",
        "PrefetchConfig",
        "Resource",
        "SourceHandler",
        "UpdateConfig",
        "UpdateControl",
        "UpdateImplementation"
    ],
    "modules": [
        "fetchers",
        "off",
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
            "displayName": "off",
            "name": "off",
            "description": "The exported module for offliner."
        },
        {
            "displayName": "sources",
            "name": "sources",
            "description": "A collection of {{#crossLink \"SourceHandler\"}}{{/crossLink}}\nconstructors to configure offliner."
        },
        {
            "displayName": "updaters",
            "name": "updaters",
            "description": "A collection of {{#crossLink \"UpdateImplementation\"}}{{/crossLink}}\nconstructors to configure offliner."
        }
    ]
} };
});