const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

const browserConfig = {
  entry: {
    pedigree: './src/app.ts',
    smartEditor: './src/smartEditor.ts',
  },

  output: {
    filename: '[name].min.js',
    path: path.resolve(__dirname, 'dist'),
    clean: false,
  },

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

// Emits a plain Node/CommonJS module wrapping the built-in default Questionnaire, so it can be
// required by scripts/generate-default-questionnaire-json.js to produce dist/defaultQuestionnaire.json
// (a non-JS-readable form for e.g. a REDCap external module composing its own effective
// Questionnaire in PHP - see questionnaire-source-of-truth design D14).
const defaultQuestionnaireDataConfig = {
  target: 'node',
  entry: {
    'defaultQuestionnaire.node': './src/script/questionnaire/defaultQuestionnaire.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    library: { type: 'commonjs2' },
    clean: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'ts-loader',
        options: { transpileOnly: true },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'pedigree': path.resolve(__dirname, 'src/script/'),
    },
  },
};

module.exports = [browserConfig, defaultQuestionnaireDataConfig];
