module.exports = ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      package: config.android?.package || 'com.demodoantotnghiep.app',
    },
  };
};
