module.exports = {
  context: __dirname + '/src',
  entry: './main.js',
  output: {
    path: __dirname + '/dist',
    filename: 'bundle.js',
  },
  // resolve: {
  //   cache: true,
  // },
  cache: false,
  plugins: [new (require('../lib/CachePlugin'))({ path: __dirname + '/dist/cache' })],
};
