// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TeachingCore",
    platforms: [.iOS("26.0"), .macOS(.v14)],
    products: [.library(name: "TeachingCore", targets: ["TeachingCore"])],
    targets: [
        .target(name: "TeachingCore"),
        .testTarget(name: "TeachingCoreTests", dependencies: ["TeachingCore"])
    ]
)
