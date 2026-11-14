#!/usr/bin/env python3
"""Run offline native casting regressions without a test entry point in the shipped app."""
import argparse
import json
import pathlib
import platform
import shutil
import subprocess
import uuid


def run(*args, **kwargs):
    return subprocess.run(args, check=True, text=True, **kwargs)


def prepare(source, output):
    destination = output / "native"
    shutil.copytree(source, destination, ignore=shutil.ignore_patterns(".build", "Verification"))
    entry = destination / "App/AltitutorTeachingApp.swift"
    text = entry.read_text()
    assert text.count("@main struct AltitutorTeachingApp") == 1
    entry.write_text(text.replace("@main struct AltitutorTeachingApp", "struct AltitutorTeachingApp"))
    fixture = source / "Verification/Casting"
    shutil.copy(fixture / "Probe.swift", destination / "App/CastingProbe.swift")
    tests = destination / "CastingUITests"
    tests.mkdir()
    shutil.copy(fixture / "CastingUITests.swift", tests)
    project = destination / "AltitutorTeaching.xcodeproj/project.pbxproj"
    text = project.read_text().replace(
        "targets = (A00000000000000000000005);",
        "targets = (A00000000000000000000005,B00000000000000000000001);",
    )
    # The real app's sources and TeachingCore dependency remain unchanged in this copy.
    entries = '''
B00000000000000000000001 = {isa = PBXNativeTarget; buildConfigurationList = B00000000000000000000002; buildPhases = (B00000000000000000000005); buildRules = (); dependencies = (); fileSystemSynchronizedGroups = (B00000000000000000000006); name = CastingUITests; productName = CastingUITests; productReference = B00000000000000000000007; productType = "com.apple.product-type.bundle.ui-testing"; };
B00000000000000000000002 = {isa = XCConfigurationList; buildConfigurations = (B00000000000000000000003,B00000000000000000000004); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
B00000000000000000000003 = {isa = XCBuildConfiguration; buildSettings = {GENERATE_INFOPLIST_FILE = YES; PRODUCT_BUNDLE_IDENTIFIER = com.altitutor.castingtests; PRODUCT_NAME = "$(TARGET_NAME)"; TEST_TARGET_NAME = AltitutorTeaching; SWIFT_VERSION = 6.0; IPHONEOS_DEPLOYMENT_TARGET = 26.0; CODE_SIGN_STYLE = Automatic; TARGETED_DEVICE_FAMILY = 2;}; name = Debug; };
B00000000000000000000004 = {isa = XCBuildConfiguration; buildSettings = {GENERATE_INFOPLIST_FILE = YES; PRODUCT_BUNDLE_IDENTIFIER = com.altitutor.castingtests; PRODUCT_NAME = "$(TARGET_NAME)"; TEST_TARGET_NAME = AltitutorTeaching; SWIFT_VERSION = 6.0; IPHONEOS_DEPLOYMENT_TARGET = 26.0; CODE_SIGN_STYLE = Automatic; TARGETED_DEVICE_FAMILY = 2;}; name = Release; };
B00000000000000000000005 = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; };
B00000000000000000000006 = {isa = PBXFileSystemSynchronizedRootGroup; path = CastingUITests; sourceTree = "<group>"; };
B00000000000000000000007 = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; path = CastingUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
'''
    project.write_text(text.replace("}; rootObject", entries + "}; rootObject"))
    scheme = destination / "AltitutorTeaching.xcodeproj/xcshareddata/xcschemes/AltitutorTeaching.xcscheme"
    action = '''<TestAction buildConfiguration="Debug"><Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="B00000000000000000000001" BuildableName="CastingUITests.xctest" BlueprintName="CastingUITests" ReferencedContainer="container:AltitutorTeaching.xcodeproj"/></TestableReference></Testables></TestAction>'''
    scheme.write_text(scheme.read_text().replace("<LaunchAction", action + "<LaunchAction"))
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=pathlib.Path, required=True, help="New task-owned artifact directory; retained for inspection")
    parser.add_argument("--simulator", help="Reuse a caller-owned simulator; it will not be shut down or deleted")
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    source = pathlib.Path(__file__).resolve().parents[2]
    destination = prepare(source, output)
    simulator = args.simulator
    owned = simulator is None
    if owned:
        devices = json.loads(run("xcrun", "simctl", "list", "devices", "available", "--json", capture_output=True).stdout)
        ipad = next(device for group in devices["devices"].values() for device in group if device["name"].startswith("iPad"))
        runtime = next(key for key, group in devices["devices"].items() if ipad in group)
        details = json.loads(run("xcrun", "simctl", "list", "devices", "--json", capture_output=True).stdout)
        device_type = next(device["deviceTypeIdentifier"] for group in details["devices"].values() for device in group if device["udid"] == ipad["udid"])
        simulator = run("xcrun", "simctl", "create", f"Teaching casting {uuid.uuid4()}", device_type, runtime, capture_output=True).stdout.strip()
    (output / "ownership.json").write_text(json.dumps({"simulator": simulator, "owned": owned}))
    try:
        if owned:
            run("xcrun", "simctl", "boot", simulator)
            run("xcrun", "simctl", "bootstatus", simulator, "-b")
        run("xcodebuild", "-project", str(destination / "AltitutorTeaching.xcodeproj"), "-scheme", "AltitutorTeaching",
            "-configuration", "Debug", "-destination", f"platform=iOS Simulator,id={simulator}",
            "-parallel-testing-enabled", "NO", "-derivedDataPath", str(output / "build"),
            "-resultBundlePath", str(output / "results.xcresult"), f"ARCHS={platform.machine()}",
            "CODE_SIGNING_ALLOWED=YES", "CODE_SIGN_IDENTITY=-", "test")
    finally:
        if owned:
            subprocess.run(["xcrun", "simctl", "shutdown", simulator], check=False)
            run("xcrun", "simctl", "delete", simulator)
            (output / "ownership.json").write_text(json.dumps({"simulator": simulator, "owned": owned, "deleted": True}))


if __name__ == "__main__":
    main()
