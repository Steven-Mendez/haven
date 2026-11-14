/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',
  name: 'HavenWatch',
  displayName: 'HAVEN',
  deploymentTarget: '11.0',
  // Hereda el ícono de la app iOS
  icon: '../../assets/images/icon.png',
});
