module.exports = {
  root: true,
  extends: '@react-native',
  env: {
    jest: true,
  },
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    'backend/',
    'scratch/',
    'scripts/',
    '*.config.js',
    'jest.setup.js',
  ],
};

