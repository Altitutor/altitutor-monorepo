const { withPodfile } = require("expo/config-plugins");

// RN 0.86's SPM injection can reuse CocoaPods' reset sequential UUIDs.
// Guard this app's generated project until RN includes the upstream fix:
// https://github.com/react/react-native/pull/57576
module.exports = function withAppleIapPodUuids(config) {
  return withPodfile(config, (mod) => {
    const marker =
      "# DEV-531: collision-safe UUIDs before StoreKit SPM injection";
    if (mod.modResults.contents.includes(marker)) return mod;
    const anchor = "  post_install do |installer|";
    if (!mod.modResults.contents.includes(anchor))
      throw new Error("UCAT IAP UUID guard: Expo Podfile post_install changed");
    mod.modResults.contents = mod.modResults.contents.replace(
      anchor,
      `${anchor}
    ${marker}
    project = installer.pods_project
    original_generate_uuid = project.method(:generate_uuid)
    project.define_singleton_method(:generate_uuid) do
      loop do
        candidate = original_generate_uuid.call
        break candidate unless objects_by_uuid.key?(candidate)
      end
    end`,
    );
    return mod;
  });
};
