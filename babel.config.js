module.exports = function babelConfig(api) {
  api.cache.using(() => `${process.env.MDP_ENVIRONMENT || ''}|${process.env.MDP_STAGING_ORIGIN || ''}`);
  const { resolveBuildTarget } = require('./scripts/build-target.cjs');
  return {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [require.resolve('./scripts/babel-build-target.cjs'), { target: resolveBuildTarget() }],
    'react-native-reanimated/plugin',
  ],
  env: {
    production: {
      plugins: ['transform-remove-console', 'react-native-reanimated/plugin'],
    },
  },
  };
};
