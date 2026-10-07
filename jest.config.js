module.exports = {
  watchman: false,
  preset: '@react-native/jest-preset',
  moduleNameMapper: { '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js' },
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage|@react-navigation|react-native-vector-icons|react-native-svg|react-native-gesture-handler|react-native-screens|react-native-safe-area-context)/)',
  ],
};
