module.exports = ({ config }) => {
  const bundleIdentifier = process.env.HAVEN_IOS_BUNDLE_ID || config.ios.bundleIdentifier;
  const appleTeamId = process.env.HAVEN_APPLE_TEAM_ID || config.ios.appleTeamId;
  return {
    ...config,
    ios: { ...config.ios, bundleIdentifier, ...(appleTeamId ? { appleTeamId } : {}) },
  };
};
