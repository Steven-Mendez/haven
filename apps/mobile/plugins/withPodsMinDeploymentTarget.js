// Xcode 27 rechaza pods con IPHONEOS_DEPLOYMENT_TARGET < 15.0 (p.ej. RNSVG declara 12.4).
// Este plugin sube el mínimo de todos los pods en el post_install del Podfile.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# [withPodsMinDeploymentTarget]';
const MIN = '15.1';

module.exports = function withPodsMinDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let src = fs.readFileSync(podfile, 'utf8');
      if (!src.includes(MARKER)) {
        src = src.replace(
          /post_install do \|installer\|\n/,
          `post_install do |installer|
    ${MARKER}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        if c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN}
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN}'
        end
      end
    end
`
        );
        fs.writeFileSync(podfile, src);
      }
      return cfg;
    },
  ]);
};
