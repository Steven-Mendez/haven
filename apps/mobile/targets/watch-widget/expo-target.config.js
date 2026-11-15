module.exports = (_config) => ({
  type: 'watch-widget',
  name: 'HAVENComplication',
  displayName: 'HAVEN',
  bundleIdentifier: '.watchkitapp.widget',
  deploymentTarget: '11.0',
  colors: { $accent: '#EDEDEF', $widgetBackground: '#000000' },
  frameworks: ['WidgetKit', 'SwiftUI'],
  entitlements: {
    'com.apple.security.application-groups': ['group.app.haven.mobile'],
  },
});
