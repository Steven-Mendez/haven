/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
// W01 · Status complication (WidgetKit, watchOS). apple-targets embeds a `watch-widget` in the watch app
// ("Embed Foundation Extensions" of HAVEN Watch), not in the iPhone app.
// Bundle id: app.haven.mobile.watchkitapp.widget (must be prefixed by the watch app's id).
// Data: the watch app writes a snapshot to the App Group below (targets/watch/Status/ComplicationStore.swift).
module.exports = (_config) => ({
  type: 'watch-widget',
  name: 'HAVEN Complication',
  displayName: 'HAVEN',
  bundleIdentifier: '.watchkitapp.widget',
  deploymentTarget: '11.0',
  colors: { $accent: '#EDEDEF', $widgetBackground: '#000000' },
  frameworks: ['WidgetKit', 'SwiftUI'],
  entitlements: {
    'com.apple.security.application-groups': ['group.app.haven.mobile'],
  },
});
