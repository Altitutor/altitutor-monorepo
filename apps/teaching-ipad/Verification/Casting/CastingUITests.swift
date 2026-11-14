import XCTest

final class CastingUITests: XCTestCase {
    @MainActor func testInkAppearsBeforeLift() {
        let app = XCUIApplication(); app.launch()
        let result = app.staticTexts["casting-result"]
        XCTAssertTrue(result.waitForExistence(timeout: 15))
        XCTAssertTrue(result.wait(for: \.label, toEqual: "ready-for-ink", timeout: 15))
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.2))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.3))
        start.press(forDuration: 0.05, thenDragTo: end, withVelocity: XCUIGestureVelocity(rawValue: 100), thenHoldForDuration: 1)
        XCTAssertEqual(result.label, "ink-before-lift")
    }

    @MainActor func testZoomAppearsDuringGesture() {
        let app = XCUIApplication(); app.launchArguments = ["zoom-probe"]; app.launch()
        let result = app.staticTexts["casting-result"]
        XCTAssertTrue(result.waitForExistence(timeout: 15))
        XCTAssertTrue(result.wait(for: \.label, toEqual: "zoom-during-gesture", timeout: 15), result.label)
    }

    @MainActor func testSolutionsStayPrivate() {
        let app = XCUIApplication(); app.launchArguments = ["solutions-probe"]; app.launch()
        let result = app.staticTexts["casting-result"]
        XCTAssertTrue(result.waitForExistence(timeout: 15))
        XCTAssertTrue(result.wait(for: \.label, toEqual: "solutions-private", timeout: 15), result.label)
    }
}
