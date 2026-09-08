module.exports = ({ config }) => {
  const existingPerms = config.android?.permissions || [];
  const requiredPerms = [
    'ACCESS_COARSE_LOCATION',
    'ACCESS_FINE_LOCATION',
    'RECORD_AUDIO',
  ];
  const mergedPerms = Array.from(new Set([...existingPerms, ...requiredPerms]));

  return {
    ...config,
    android: {
      ...config.android,
      package: config.android?.package || 'com.demodoantotnghiep.app',
      permissions: mergedPerms,
    },
  };
};
