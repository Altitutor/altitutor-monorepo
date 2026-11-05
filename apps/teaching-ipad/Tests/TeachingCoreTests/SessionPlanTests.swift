import Foundation
import Testing
@testable import TeachingCore

@MainActor @Test func reopeningPlanImportsOnlyNewResourcesAndPreservesLocalTeaching() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let tutor = UUID(), session = UUID(), store = try LessonStore(root: root, tutorID: tutor)
    func resource(_ name: String) -> TeachingResource {
        TeachingResource(id: UUID(), topicID: UUID(), topicName: name, subjectID: UUID(), subjectName: "Mathematics",
            worksheet: TeachingDocument(id: UUID(), title: name + ".pdf", mimeType: "application/pdf", externalURL: nil), solutions: nil)
    }
    let existing = resource("Algebra"), addition = resource("Functions")
    let original = try #require(store.add(existing, to: session, worksheet: Data("original".utf8), solutions: nil).resources.first)
    try store.saveDrawing(Data([1, 2, 3]), sessionID: session, document: original.worksheet, page: 0)
    let plan = SessionLessonPlan(sessionID: session, revision: 1, topics: [], resources: [existing, addition])
    let imported = try await store.importPlan(plan) { _ in Data("planned PDF".utf8) }
    #expect(imported.resources.map(\.resource?.id) == [existing.id, addition.id])
    #expect(imported.resources.first?.worksheet.id == original.worksheet.id)
    #expect(try Data(contentsOf: store.documentURL(sessionID: session, document: original.worksheet)) == Data("original".utf8))
    #expect(try store.drawing(sessionID: session, document: original.worksheet, page: 0) == Data([1, 2, 3]))
    let added = try #require(imported.resources.last)
    _ = try store.remove(added.id, from: session)
    let reopened = try LessonStore(root: root, tutorID: tutor)
    let again = try await reopened.importPlan(plan) { _ in throw CocoaError(.fileReadUnknown) }
    #expect(again.resources.map(\.resource?.id) == [existing.id])
    #expect(again.archivedResources.map(\.resource?.id) == [addition.id])
}

@MainActor @Test func standalonePlannedTopicsAreCachedWithoutClaimingTheyWereTaught() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let tutor = UUID(), session = UUID(), store = try LessonStore(root: root, tutorID: tutor)
    let topic = SessionPlanTopic(id: UUID(), name: "Functions", code: "F1")
    let plan = SessionLessonPlan(sessionID: session, revision: 2, topics: [topic], resources: [])
    _ = try await store.importPlan(plan) { _ in throw CocoaError(.fileReadUnknown) }
    let reopened = try LessonStore(root: root, tutorID: tutor)
    #expect(try reopened.lesson(sessionID: session).plannedTopics == [topic])
    #expect(try reopened.logSuggestions(sessionID: session, attendingStudents: [UUID()]).topics.isEmpty)
    let stale = SessionLessonPlan(sessionID: session, revision: 1, topics: [], resources: [])
    #expect(try await reopened.importPlan(stale) { _ in Data() }.plannedTopics == [topic])
}
