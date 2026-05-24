const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: './src/app.js',

  output: {
    filename: 'pedigree.min.js',
    path: path.resolve(__dirname, 'dist'),
    clean: false,
  },

  externals: [
    'XWiki', // XWiki JS library
    'Class', // PrototypeJS
    'Prototype',
    '$$',
    '$',
    '$F',
  ],

  module: {
    rules: [
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
          publicPath: 'dist/assets/',
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

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          mangle: {
            reserved: ['$super'],
          },
        },
      }),
    ],
  },

  resolve: {
    alias: {
      'pedigree': path.resolve(__dirname, 'src/script/'),
      'vendor': path.resolve(__dirname, 'public/vendor/'),
    }
  }
};
