# DEPRECATED

This plugin was an experiment and meant to contribute to the caching discussion for webpack. Instead of trying to use this checkout the follow up, (hard-source-webpack-plugin](https://github.com/mzgoddard/hard-source-webpack-plugin), which works!

# webpack-cache-module-plugin

Experimental plugin to support longer term caching. At the moment manually stores built module details for a later run. During that later run it sees a normal module has an entry in the cache, if so it returns a CachedModule skipping work like parsing the content to determine dependencies.

This version also caches resolved file paths. These file path resolutions are the far larger time saver than the modules, parsing them, etc.

## TODO

- add plugin hooks to support different modules, sources, dependencies, etc
- add default hook implementations for webpack built in modules, sources, deps, etc

## Testing

Being too experimental at this point, this doesn't have a test suite. But in the test folder will be some helpers in the meantime to generate projects of different sizes to test the cache ability.

```sh
cd test
# generate a set of 10 folders containing 10 folders containing 10 scripts
node helpers/make-a-tree.js simple 10 10 10
# bundle it up, this will produce a cache.json used by the next run
node ../node_modules/.bin/webpack
node dist/bundle.js
# 813001.71875

# webpack again, and see how fast it is!
node ../node_modules/.bin/webpack
# the bundle will have the same result
node dist/bundle.js
# 813001.71875

# modify a file and see that its mentioned when building again but not the
# other files
```

### test/helpers/make-a-tree.js

Generates a folder structure to test with caching.

```sh
# Generate a project whose resulting bundle returns a number depending on the
# number of folders
node helpers/make-a-tree.js simple n..
```
