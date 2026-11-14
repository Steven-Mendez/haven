/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (_config) => ({
  type: 'watch',
  name: 'HAVEN Watch',
  displayName: 'HAVEN',
  // app.haven.mobile.watchkitapp. apple-targets sets WKCompanionAppBundleIdentifier = app.haven.mobile
  // and embeds the watch app in the iPhone app ("Embed Watch Content").
  bundleIdentifier: '.watchkitapp',
  icon: '../../assets/images/icon.png',
  colors: { $accent: '#FAFAFA' },
  deploymentTarget: '11.0',
  frameworks: ['WatchConnectivity', 'HealthKit', 'WidgetKit'],
  // HealthKit: heart rate (W01) and workout session with live heart rate (W04).
  // App Group (W01): shared with the complication in targets/watch-widget.
  entitlements: {
    'com.apple.developer.healthkit': true,
    'com.apple.developer.healthkit.access': [],
    'com.apple.security.application-groups': ['group.app.haven.mobile'],
  },
});
