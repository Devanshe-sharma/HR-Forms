import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load the correct .env file based on mode
const mode = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, `.env.${mode}`) });

export default {
  entry: './src/main.tsx',
  mode,

  // Fast-rebuild source maps for development — no meaningful compile-time
  // cost, and still points at real source lines in the browser debugger.
  // Previously unset, which meant no source maps at all.
  devtool: mode === 'development' ? 'eval-cheap-module-source-map' : 'source-map',

  // Persistent disk cache between webpack-dev-server restarts (and
  // between `npm run dev` invocations generally) — webpack 5 supports
  // this natively. The first build after this is added still compiles
  // from scratch, but every restart after that reuses cached module
  // results instead of recompiling everything from zero.
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },

  devServer: {
    historyApiFallback: true,
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    ],
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            // This is the single biggest win here: by default ts-loader
            // runs full TypeScript type-checking on every file on every
            // compile, which is dramatically slower than plain
            // transpilation. transpileOnly skips that — webpack now only
            // strips types and emits JS, nothing more.
            //
            // Type-checking itself isn't gone, just moved out of the hot
            // path: your editor's TS server already checks live as you
            // type, and `npx tsc --noEmit` run separately (in CI, a
            // pre-commit hook, or just manually before a big push) will
            // still catch anything the editor didn't. If you'd rather
            // have checking run automatically in a background thread
            // without slowing down bundling, `fork-ts-checker-webpack-
            // plugin` does exactly that — happy to wire it in if wanted,
            // but it's a new dependency so not adding it silently here.
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    publicPath: '/',
    clean: true,
  },

  // Splits node_modules out of your app code into its own chunk instead
  // of one single 10+ MB bundle. This means: (1) the browser can cache
  // the vendor chunk separately, so it doesn't need re-downloading every
  // time your OWN code changes but your dependencies haven't, and (2) if
  // you later add route-based lazy loading (React.lazy + dynamic
  // import()), those chunks split cleanly on top of this instead of
  // still being crammed into the one giant bundle.
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },

  plugins: [
    new HtmlWebpackPlugin({ template: './public/index.html' }),
    new webpack.DefinePlugin({
      'process.env.REACT_APP_REACT_APP_API_BASE_URL': JSON.stringify(process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api'),
      'process.env.NODE_ENV':     JSON.stringify(mode),
      'process.env':              JSON.stringify({}),
      'process':                  JSON.stringify({ env: {} }),
    }),
  ],
};
