// NOTE: We're not using default webpack config from @tmap/serverless due to handlebars needing special treatment

import { Configuration } from 'webpack';
import nodeExternals from 'webpack-node-externals';
import path from 'path';
import slsw from 'serverless-webpack';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const webPackConfig: Configuration = {
  mode: 'development', // Better to specify it all ourselves
  entry: slsw.lib.entries,
  externals: [
    nodeExternals()
    // nodeExternals({
    //   modulesDir: path.resolve(__dirname, 'chrome-layer-1/', 'nodejs', 'node_modules')
    // })
  ],
  plugins: [
    // No typechecking for local = much faster / happier dev experience
    ...(process.env.TS_NODE_TRANSPILE_ONLY?.toUpperCase() !== 'TRUE'
      ? // By convention everything lambda lives under src
        [new ForkTsCheckerWebpackPlugin({ eslint: { files: 'src/**/*.ts', memoryLimit: 8192 } })]
      : [])
  ],
  optimization: {
    minimize: false
  },
  devtool: slsw.lib.webpack.isLocal ? 'eval-cheap-module-source-map' : 'source-map',
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx']
    // alias: { 'puppeteer-core': 'puppeteer-core/dist/cjs/puppeteer' }
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js'
  },
  target: 'node',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: [
          [
            path.resolve(__dirname, 'node_modules'),
            path.resolve(__dirname, '.serverless'),
            path.resolve(__dirname, '.webpack')
          ]
        ],
        options: {
          transpileOnly: true,
          experimentalWatchApi: true
        }
      },
      {
        test: /\.handlebars$/,
        loader: 'handlebars-loader'
      }
    ]
  }
};

// export default no worky for some reason!
module.exports = webPackConfig;
