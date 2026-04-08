const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../shared');

const config = {
  watchFolders: [sharedRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
