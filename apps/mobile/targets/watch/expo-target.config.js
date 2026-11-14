/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',
  name: 'PoleHavenWatch',
  displayName: 'Pole Haven',
  deploymentTarget: '11.0',
  // Hereda el ícono de la app iOS
  icon: '../../assets/images/icon.png',
});
