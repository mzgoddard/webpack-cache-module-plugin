/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var fs = require('fs');
var nodefs = fs;
var path = require('path');

var _ = require('lodash');
var mkdirp = require('mkdirp');

var async = require("webpack/node_modules/async");

var NormalModule = require('webpack/lib/NormalModule');
var RawSource = require('webpack/node_modules/webpack-core/lib/ReplaceSource');
var ReplaceSource = require('webpack/node_modules/webpack-core/lib/ReplaceSource');
var OriginalSource = require('webpack/node_modules/webpack-core/lib/OriginalSource');

var CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency');

var CachedModule = require('./CachedModule');

var typeNames = [
'CachedSource',
'RawSource',
'OriginalSource',
// 'SourceMappedSource',
'ConcatSource',
'PrefixSource',
'ReplaceSource',
'LineToLineMappedSource',
'Source',
];

var types = typeNames.map(function(name) { return require('webpack/node_modules/webpack-core/lib/' + name); });

function findNameForType(names, types, obj) {
  return names[_.findIndex(types, function(type) {
    return type && obj instanceof type;
  })];
}

const SourceType = findNameForType.bind(null, typeNames, types);

var dependencyNames = [
  'CommonJsRequireDependency',
  'RequireHeaderDependency'
];

var dependencyClasses = dependencyNames.map(function(name) { return require('webpack/lib/dependencies/' + name); });

const DependencyType = findNameForType.bind(null, dependencyNames, dependencyClasses);

function CachePlugin(options) {
	this.cache = options.cache || {};
  this.path = options.path || null;
}
module.exports = CachePlugin;

CachePlugin.prototype.apply = function(compiler) {
  if(Array.isArray(compiler.compilers)) {
    compiler.compilers.forEach(function(c, idx) {
      var options = Object.create(this.options);
      options.path = path.join(options.path || compiler.options.output.path, idx.toString());
      options.cache = this.cache[idx] = this.cache[idx] || {}
      c.apply(new CachePlugin(options));
    }, this);
  } else {
    var cachePath = path.resolve(this.path || compiler.options.output.path);
    // try { fs.mkdir(path.join(cachePath)); } catch (e) {}
    var cacheFile = path.join(cachePath, 'cache.json');

    var lastCacheData;
    try {
      lastCacheData = JSON.parse(fs.readFileSync(cacheFile));
    } catch (error) {
      console.error(error);
    }

    // TODO: UnsafeCache clone. Separate logic into a different plugin (UnsafeDiskCache).
    var resolveCache = lastCacheData ? lastCacheData.resolve : {};

    var oldResolve = compiler.resolvers.normal.resolve;
    compiler.resolvers.normal.resolve = function(context, request, fn) {
      if (resolveCache[context] && resolveCache[context][request]) {
        return fn(null, resolveCache[context][request]);
      }
      oldResolve.call(compiler.resolvers.normal, context, request, function(err, output) {
        if (err) {
          return fn(err);
        }

        resolveCache[context] = resolveCache[context] || {};
        resolveCache[context][request] = output;
        fn(null, output);
      });
    };

    compiler.plugin("compilation", function(compilation, params) {
      var lastCacheData;
      try {
        lastCacheData = Object.freeze(JSON.parse(fs.readFileSync(cacheFile)));
      } catch (error) {
        console.error(error);
      }

      var normalModuleFactory = params.normalModuleFactory;
      var cache = lastCacheData ? lastCacheData.cache : {};
      var thawed = {};

      normalModuleFactory.plugin("module", function(module) {
        if (
          thawed[module.identifier()] &&
            compiler.fileTimestamps[module.request] <= thawed[module.identifier()].buildTimestamp
        ) {
          module = thawed[module.identifier()];
        }
        else
        if (module instanceof NormalModule) {
          var cacheItem = _.find(cache, function(item) {
            return item.request === module.request
              && compiler.fileTimestamps[module.request] <= item.buildTimestamp;
          });
          if (cacheItem) {
            var source = new OriginalSource(cacheItem._source._value, cacheItem._source._name);
            var cachedSource = new ReplaceSource(source);
            cachedSource.replacements = cacheItem._cachedSource.source.replacements;
            module = new CachedModule(cache, module, cacheItem, source, cachedSource);
            module.cacheable = true;
            thawed[module.identifier()] = module;
          };
        }

        return module;
      });

      // compilation.cache = this.cache;
    }.bind(this));

    compiler.plugin(["watch-run", "run"], function(arg0, callback) {
      var cache = lastCacheData;

      if (!cache) return callback();

      var fs = compiler.inputFileSystem;
      if (!compiler.fileTimestamps) {
        compiler.fileTimestamps = {};
      }
      var fileTs = compiler.fileTimestamps;

      async.forEach(cache.fileDependencies, function(file, callback) {
        fs.stat(file, function(err, stat) {
          if(err) {
            if(err.code === "ENOENT") return callback();
            return callback(err);
          }

          fileTs[file] = stat.mtime.getTime() || Infinity;
          callback();
        });
      }, function() {
        callback();
      });
    });

    compiler.plugin("after-compile", function(compilation, callback) {
      var cacheString = JSON.stringify(
        _.chain(compilation.modules)
          .filter(function(module) { return !module.error && module.cacheable; })
          .filter(function(module) {
            return module instanceof NormalModule || module instanceof CachedModule;
          })
          .filter(function(partial) {
            return partial._cachedSource.source instanceof ReplaceSource &&
              partial._cachedSource.source._source instanceof OriginalSource;
          })
          .map(function(item) {
            // PLUGIN_POINT: "freeze-module"
            return {
              _cachedSource: item._cachedSource,
              _source: item._source,
              buildTimestamp: item.buildTimestamp,
              request: item.request,
              errors: item.errors,
              warnings: item.warnings,
              dependencies: item.dependencies,
              fileDependencies: item.fileDependencies,
              contextDependencies: item.contextDependencies,
              meta: item.meta,
            };
          })
          .map(function(item) {
            // PLUGIN_POINT: "freeze-dependency" part of "freeze-source" part of "freeze-module"
            item.dependencies = item.dependencies
              .map(function(dep) {
                var ClassName = DependencyType(dep);
                if (!ClassName) {
                  // console.log(dep);
                  throw new Error('Unregistered dependency class.');
                }
                return {
                  Class: ClassName,
                  request: dep.request,
                  range: dep.range,
                };
              });
            return item;
          })
          .thru(function(cache) {
            // PLUGIN_POINT: "update-storage"
            return {
              fileDependencies: compilation.fileDependencies,
              contextDependencies: compilation.contextDependencies,
              cache: cache,
              resolve: resolveCache,
            };
          })
          .value()
      );

      mkdirp.sync(cachePath);
      fs.writeFileSync(cacheFile, cacheString);
      callback();
    });

  }
};
