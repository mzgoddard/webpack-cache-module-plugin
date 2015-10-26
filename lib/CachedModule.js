/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
const Module = require('webpack/lib/module');

var CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency');

var dependencyNames = [
  'CommonJsRequireDependency',
  'RequireHeaderDependency'
];

var dependencyClasses = dependencyNames
  .map(function(name) { return require('webpack/lib/dependencies/' + name); });

var dependencyFactories = [
  function(cache, dep) { return new (dependencyClasses[0])(dep.request, dep.range); },
  function(cache, dep) { return new (dependencyClasses[1])(dep.range); },
];

function restoreDependency(cache, dep) {
  return dependencyFactories[dependencyNames.indexOf(dep.Class)](cache, dep);
}

function CachedModule(cache, module, cacheEntry, source, cachedSource) {
  this._module = module;
  this._buildTimestamp = cacheEntry.buildTimestamp;
  this._module.fileDependencies = cacheEntry.fileDependencies;
  this._module.contextDependencies = cacheEntry.contextDependencies;
  this._module.dependencies = cacheEntry.dependencies.map(restoreDependency.bind(null, cache));
  this._module._source = source;
}
module.exports = CachedModule;

CachedModule.prototype = Object.create(Module.prototype);
CachedModule.prototype.constructor = CachedModule;

CachedModule.prototype.build = function(options, compilation, resolver, fs, callback) {
  if (!this.buildTimestamp) {
    this._module.buildTimestamp = this._buildTimestamp;
    if (!this._module.needRebuild(compilation.fileTimestamps, compilation.contextTimestamps)) {
      return callback();
    }
  }

  return this._module.build.apply(this._module, arguments);
};

CachedModule.prototype.needRebuild = function() {
  if (!this._module.buildTimestamp) {
    return true;
  }
  return this._module.needRebuild.apply(this._module, arguments);
};

[
  'identifier',
  'readableIdentifier',
  'libIdent',
  'fillLoaderContext',
  'disconnect',
  // 'build',
  'source',
  // 'needRebuild',
  'size',
  'updateHash',
  'getSourceHash',
  'getAllModuleDependencies',
  'createTemplate',
  'getTemplateArguments',
  'hasDependencies'
].forEach(function(key) {
  CachedModule.prototype[key] = function() {
    return this._module[key].apply(this._module, arguments);
  };
});

[
  'debugId',
  'id',
  'lastId',
  'index',
  'index2',
  'context',
  'blocks',
  'request',
  'userRequest',
  'rawRequest',
  'parser',
  'meta',
  'assets',
  'errors',
  'warnings',
  'dependencies',
  'dependenciesWarnings',
  'dependenciesErrors',
  'reasons',
  'chunks',
  'variables',
  '_source',
  '_cachedSource',
  'fileDependencies',
  'contextDependencies',
  'cacheable',
  'built',
  'buildTimestamp'
].forEach(function(key) {
  Object.defineProperty(CachedModule.prototype, key, {
    get: function() {
      return this._module[key];
    },
    set: function(value) {
      this._module[key] = value;
    },
  })
});
