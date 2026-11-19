module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo ya configura Reanimated/Worklets y las variables EXPO_PUBLIC_*.
  return {
    presets: ["babel-preset-expo"],
  };
};
