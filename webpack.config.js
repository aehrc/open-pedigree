const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: './src/app.js',

  output: {
    filename: 'pedigree.min.js',
    path: path.resolve(__dirname, 'dist'),
    clean: false,
  },

  externals: [],

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'ts-loader',
        options: { transpileOnly: true },
      },
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env']
        }
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              url: {
                // Absolute paths (e.g. /resources/icons/xwiki/...) are XWiki
                // server-side resources; leave them unresolved for runtime.
                filter: (url) => !url.startsWith('/'),
              },
            },
          },
        ]
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              url: {
                filter: (url) => !url.startsWith('/'),
              },
            },
          },
          'sass-loader',
        ]
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]',
          publicPath: 'dist/',
        }
      }
    ]
  },

  devServer: {
    static: {
      directory: path.join(__dirname, '.'),
    },
    devMiddleware: {
      publicPath: '/dist/',
    },
    port: 9000
  },

  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
      jQuery: 'jquery',
      $: 'jquery',
    }),
  ],

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin(),
    ],
  },

  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'pedigree': path.resolve(__dirname, 'src/script/'),
      'vendor': path.resolve(__dirname, 'public/vendor/'),
    },
    fallback: {
      stream: require.resolve('stream-browserify'),
      util: require.resolve('util/'),
      buffer: require.resolve('buffer/'),
    },
  }
};
