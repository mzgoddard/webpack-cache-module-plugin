const fs = require('fs');
const path = require('path');

var functions = [

  [
    'var $fn = function(n) {',
    '  return n;',
    '};',
  ].join('\n'),

  [
    'var $fn = function(n) {',
    '  return n + 1;',
    '};',
  ].join('\n'),

  [
    'var $fn = function(v) {',
    '  return v * 2;',
    '};',
  ].join('\n'),

  [
    'var $fn = function(v) {',
    '  return v / 2;',
    '};',
  ].join('\n'),

];

var CHAR_a = 'a'.charCodeAt(0);

var rnd = function(a, b, c, lastValue) {
  return (((lastValue + a) * b) % c);
};

var rnd1 = rnd.bind(null, 103, 113, 79);
var rnd2 = rnd.bind(null, 163, 439, 211);

var gen = function(seed) {
  var n = ((seed + 97) * 61) % 13 + 10;
  var src = '';
  var calls = [];
  for (var i = 0; i < n; i++) {
    var srcTemplate = functions[(seed + rnd1(i)) % functions.length];
    src += srcTemplate.replace(/\$fn/g, String.fromCharCode(CHAR_a + i)) + '\n';
    calls.push(String.fromCharCode(CHAR_a + i));
  }
  src += 'var output = [' +
    calls
      .reduce(function(out, fn, i, a) { out.splice((Math.random() * a.length) | 0, 0, fn); return out;}, [])
      .toString() +
    '].reduce(function(v, fn) { return fn(v); }, ' + rnd2(seed) + ');\n';
  return src;
};

function writeFiles(options, prefix, index) {
  if (index < options.max.length) {
    try { fs.mkdirSync(prefix); } catch (error) {}
  }
  var source = 'module.exports =\n';
  var seed = prefix
    .split(/[/\\]/g)
    .filter(function(v) { return /\d+/.test(v); })
    .map(function(v, i) { return parseInt(v) * Math.pow(10, i); })
    .reduce(function(v, a) { return v + a; }, 0);
  for (var i = 0; i < options.max[index]; ++i) {
    source += '  + require("./' + i + '")\n';
    if (index < options.max.length - 1) {
      fs.writeFileSync(
        path.resolve(prefix, '' + i, 'index.js'),
        writeFiles(options, path.resolve(prefix, '' + i), index + 1)
      );
    }
    if (index === options.max.length - 1) {
      fs.writeFileSync(
        path.resolve(prefix, i + '.js'),
        gen(seed + i * Math.pow(10, index))
          + 'module.exports = '
          + (i < options.max[index] - 1 ? 'require("./' + (i + 1) + '")'  : '')
          + ' + output;\n'
      );
    }
  }
  source += '  ;\n';
  return source;
}

function main(options) {
  var prefix = options.path;
  try { fs.mkdirSync(path.dirname(prefix)); } catch (error) {}
  fs.writeFileSync(
    path.resolve(prefix, 'main.js'),
    writeFiles(options, prefix, 0) + 'console.log(module.exports);\n'
  );
}

if (require.main === module) {
  var commander = require('commander');

  commander.option('--path <PATH>', 'Directory to output project', path.resolve(__dirname, '..', 'src'));

  commander.command('simple <n...>')
    .action(function(n, options) {
      main({
        max: n.map(function(v) { return parseInt(v); }),
        path: options.parent.path,
      });
    });

  commander.parse(process.argv);
}

module.exports = main;
