const { withAndroidManifest } = require('@expo/config-plugins');

const withLargeHeap = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    if (androidManifest.manifest.application && androidManifest.manifest.application[0]) {
      androidManifest.manifest.application[0].$['android:largeHeap'] = 'true';
    }
    return config;
  });
};

module.exports = withLargeHeap;
