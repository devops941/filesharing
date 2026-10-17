const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// Polyfill 'buffer' so react-native-tcp-socket and crypto code work
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve('buffer'),
};

module.exports = config;
