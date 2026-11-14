Pod::Spec.new do |s|
  s.name           = 'HavenWatch'
  s.version        = '1.0.0'
  s.summary        = 'WatchConnectivity bridge between the HAVEN iPhone app and its Apple Watch app.'
  s.description    = 'Local Expo module (contract C): sends and receives JSON envelopes of the watch–phone contract.'
  s.author         = 'HAVEN'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = 'MIT'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity', 'HealthKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
