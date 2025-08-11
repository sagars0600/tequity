module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
        exclude: /node_modules/, // ← ignore all source maps in node_modules
      },
      // other rules...
    ],
    ignoreWarnings: [
      {
        module: /react-axe/,
        message: /Failed to parse source map/,
      },
    ],
  },


};
