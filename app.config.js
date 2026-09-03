module.exports = ({ config }) => {
  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    config.android?.config?.googleMaps?.apiKey ||
    'YOUR_GOOGLE_MAPS_API_KEY';

  return {
    ...config,
    android: {
      ...config.android,
      package: config.android?.package || 'com.demodoantotnghiep.app',
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
  };
};
