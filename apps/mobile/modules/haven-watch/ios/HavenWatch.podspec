Pod::Spec.new do |s|
  s.name           = 'HavenWatch'
  s.version        = '1.0.0'
  s.summary        = 'Puente WatchConnectivity entre la app de iPhone y la del Apple Watch.'
  s.author         = 'HAVEN'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
