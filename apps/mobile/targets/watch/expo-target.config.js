module.exports = (_config) => ({
  type: 'watch',
  name: 'HAVENWatch',
  displayName: 'HAVEN',
  bundleIdentifier: '.watchkitapp',
  icon: '../../assets/images/icon.png',
  colors: { $accent: '#FAFAFA' },
  deploymentTarget: '11.0',
  frameworks: ['WatchConnectivity', 'HealthKit', 'WidgetKit'],
  entitlements: {
    'com.apple.developer.healthkit': true,
    'com.apple.developer.healthkit.access': [],
    'com.apple.security.application-groups': ['group.app.haven.mobile'],
  },
});
