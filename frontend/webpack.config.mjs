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

  devServer: {
    port: 5173,
    historyApiFallback: true,
    hot: true,
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
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
    filename: 'bundle.js',
    clean: true,
  },

  plugins: [
    new HtmlWebpackPlugin({ template: './public/index.html' }),
    new webpack.DefinePlugin({
      'process.env.API_BASE_URL': JSON.stringify(process.env.API_BASE_URL || 'http://localhost:5000/api'),
      'process.env.NODE_ENV':     JSON.stringify(mode),
      'process.env':              JSON.stringify({}),
      'process':                  JSON.stringify({ env: {} }),
    }),
  ],
};