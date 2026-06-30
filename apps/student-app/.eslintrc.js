module.exports = {
  root: true,
  extends: ['expo'],
  rules: {
    'react-hooks/set-state-in-effect': 'off',
  },
  ignorePatterns: ['dist/', 'android/', 'ios/', '.expo/'],
}
