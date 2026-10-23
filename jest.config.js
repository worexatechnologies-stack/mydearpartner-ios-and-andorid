module.exports = {
  watchman: false,
  preset: '@react-native/jest-preset',
  moduleNameMapper: { '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js' },
  setupFiles: ['./jest.setup.js'],
  // Isolated backend/website audit checkouts use their own test runners.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/scratch/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage|@react-navigation|react-native-reanimated|react-native-worklets|react-native-worklets-core|react-native-vector-icons|react-native-svg|react-native-gesture-handler|react-native-screens|react-native-safe-area-context)/)',
  ],
};
