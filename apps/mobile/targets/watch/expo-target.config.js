/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
// Bundle id <ios.bundleIdentifier>.watchkitapp; prebuild lo incrusta en la app del iPhone.
module.exports = (_config) => ({
  type: 'watch',
  name: 'HavenWatch',
  displayName: 'HAVEN',
  bundleIdentifier: '.watchkitapp',
  icon: '../../assets/images/icon.png',
  deploymentTarget: '11.0',
  frameworks: ['WatchConnectivity'],
});
