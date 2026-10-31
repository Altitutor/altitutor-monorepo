import Foundation
import Testing
@testable import TeachingCore

@Test func annotationsStayWithTheirTutorAndSessionAfterReopening() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let tutor = UUID(), otherTutor = UUID(), session = UUID(), anotherSession = UUID()
    let resource = TeachingResource(
        id: UUID(), topicID: UUID(), topicName: "Differentiation", subjectID: UUID(), subjectName: "Mathematics",
        worksheet: TeachingDocument(id: UUID(), title: "Practice.pdf", mimeType: "application/pdf", externalURL: nil),
        solutions: nil
    )
    let store = try LessonStore(root: root, tutorID: tutor)
    let lesson = try store.add(resource, to: session, worksheet: Data("original PDF".utf8), solutions: nil)
    let document = try #require(lesson.resources.first).worksheet
    try store.saveDrawing(Data([1, 2, 3]), sessionID: session, document: document, page: 0)

    let reopened = try LessonStore(root: root, tutorID: tutor)
    #expect(try reopened.drawing(sessionID: session, document: document, page: 0) == Data([1, 2, 3]))
    #expect(try reopened.lesson(sessionID: anotherSession).resources.isEmpty)
    let other = try LessonStore(root: root, tutorID: otherTutor)
    #expect(try other.lesson(sessionID: session).resources.isEmpty)
    #expect(throws: (any Error).self) { try other.documentURL(sessionID: session, document: document) }
}

@Test func readdingAnUpdatedFileKeepsTheLessonOriginalUntilFreshCopyIsRequested() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let store = try LessonStore(root: root, tutorID: UUID()), session = UUID()
    let resource = TeachingResource(id: UUID(), topicID: UUID(), topicName: "Topic", subjectID: UUID(), subjectName: "Subject",
        worksheet: TeachingDocument(id: UUID(), title: "Original.pdf", mimeType: "application/pdf", externalURL: nil), solutions: nil)
    _ = try store.add(resource, to: session, worksheet: Data("first version".utf8), solutions: nil)
    let again = try store.add(resource, to: session, worksheet: Data("replacement".utf8), solutions: nil)
    #expect(again.resources.count == 1)
    let original = try #require(again.resources.first)
    #expect(try Data(contentsOf: store.documentURL(sessionID: session, document: original.worksheet)) == Data("first version".utf8))
}

@Test func worksheetsAndSolutionsKeepIndependentViewportsAndInk() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let store = try LessonStore(root: root, tutorID: UUID()), session = UUID()
    let resource = TeachingResource(id: UUID(), topicID: UUID(), topicName: "Topic", subjectID: UUID(), subjectName: "Subject",
        worksheet: TeachingDocument(id: UUID(), title: "Practice.pdf", mimeType: "application/pdf", externalURL: nil),
        solutions: TeachingDocument(id: UUID(), title: "Solutions.pdf", mimeType: "application/pdf", externalURL: nil))
    let record = try store.add(resource, to: session, worksheet: Data([1]), solutions: Data([2]))
    let added = try #require(record.resources.first), solution = try #require(added.solutions)
    try store.saveViewport(DocumentViewport(page: 2, x: 10, y: 40, scale: 1.5, rotation: 0), sessionID: session, document: added.worksheet)
    try store.saveViewport(DocumentViewport(page: 6, x: 50, y: 70, scale: 2, rotation: 90), sessionID: session, document: solution)
    try store.saveDrawing(Data([9]), sessionID: session, document: solution, page: 6)
    #expect(try store.viewport(sessionID: session, document: added.worksheet).page == 2)
    #expect(try store.viewport(sessionID: session, document: solution).rotation == 90)
    #expect(try store.drawing(sessionID: session, document: added.worksheet, page: 6) == nil)
    #expect(try store.drawing(sessionID: session, document: solution, page: 6) == Data([9]))
}

@Test func everyAddedWorksheetSuggestsItsFileAndTopicEvenBeforeItIsOpened() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let store = try LessonStore(root: root, tutorID: UUID()), session = UUID(), topic = UUID(), student = UUID()
    let first = UUID(), second = UUID()
    for file in [first, second] {
        let resource = TeachingResource(id: file, topicID: topic, topicName: "Differentiation", subjectID: UUID(), subjectName: "Mathematics",
            worksheet: TeachingDocument(id: file, title: "Practice.pdf", mimeType: "application/pdf", externalURL: nil),
            solutions: TeachingDocument(id: UUID(), title: "Answers.pdf", mimeType: "application/pdf", externalURL: nil))
        _ = try store.add(resource, to: session, worksheet: Data([1]), solutions: Data([2]))
    }
    let draft = try store.logSuggestions(sessionID: session, attendingStudents: [student])
    #expect(draft.topics.count == 1)
    #expect(draft.topics.first?.topicId == topic)
    #expect(draft.topics.first?.studentIds == [student])
    #expect(Set(draft.topicFiles.map(\.topicsFilesId)) == Set([first, second]))
}

@Test func reviewingDraftCanRemoveSuggestionsWithoutDeletingTheLocalWorksheet() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let tutor = UUID(), store = try LessonStore(root: root, tutorID: tutor), session = UUID(), attending = UUID(), absent = UUID()
    let resource = TeachingResource(id: UUID(), topicID: UUID(), topicName: "Topic", subjectID: UUID(), subjectName: "Subject",
        worksheet: TeachingDocument(id: UUID(), title: "Practice.pdf", mimeType: "application/pdf", externalURL: nil), solutions: nil)
    let record = try store.add(resource, to: session, worksheet: Data([1]), solutions: nil)
    let added = try #require(record.resources.first)
    var draft = record.draft
    draft.studentAssignments[added.id] = [attending, absent]
    try store.saveDraft(draft, sessionID: session)
    #expect(try store.logSuggestions(sessionID: session, attendingStudents: [attending]).topicFiles.first?.studentIds == [attending])
    draft.excludedResources.insert(added.id)
    try store.saveDraft(draft, sessionID: session)
    let reopened = try LessonStore(root: root, tutorID: tutor)
    #expect(try reopened.logSuggestions(sessionID: session, attendingStudents: [attending]).topics.isEmpty)
    #expect(try reopened.lesson(sessionID: session).resources.count == 1)
}

@Test func explicitFreshCopyRetainsOriginalDocumentAndAnnotations() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let store = try LessonStore(root: root, tutorID: UUID()), session = UUID()
    let resource = TeachingResource(id: UUID(), topicID: UUID(), topicName: "Topic", subjectID: UUID(), subjectName: "Subject",
        worksheet: TeachingDocument(id: UUID(), title: "Practice.pdf", mimeType: "application/pdf", externalURL: nil), solutions: nil)
    let original = try #require(store.add(resource, to: session, worksheet: Data([1]), solutions: nil).resources.first)
    try store.saveDrawing(Data([8]), sessionID: session, document: original.worksheet, page: 0)
    let fresh = try store.add(resource, to: session, worksheet: Data([2]), solutions: nil, freshCopy: true)
    #expect(fresh.resources.count == 2)
    #expect(try store.drawing(sessionID: session, document: original.worksheet, page: 0) == Data([8]))
    #expect(try store.logSuggestions(sessionID: session, attendingStudents: []).topicFiles.count == 1)
}

@Test func removingLessonResourceClearsSuggestionsAndReaddingRestoresItsInk() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let store = try LessonStore(root: root, tutorID: UUID()), session = UUID()
    let resource = TeachingResource(id: UUID(), topicID: UUID(), topicName: "Topic", subjectID: UUID(), subjectName: "Subject",
        worksheet: TeachingDocument(id: UUID(), title: "Test 1.pdf", mimeType: "application/pdf", externalURL: nil), solutions: nil)
    let added = try #require(store.add(resource, to: session, worksheet: Data([1]), solutions: nil).resources.first)
    try store.saveDrawing(Data([9, 8]), sessionID: session, document: added.worksheet, page: 0)
    let removed = try store.remove(added.id, from: session)
    #expect(removed.resources.isEmpty)
    #expect(try store.logSuggestions(sessionID: session, attendingStudents: []).topicFiles.isEmpty)
    #expect(throws: (any Error).self) { try store.documentURL(sessionID: session, document: added.worksheet) }
    let restored = try #require(store.add(resource, to: session, worksheet: Data([2]), solutions: nil).resources.first)
    #expect(restored.worksheet.id == added.worksheet.id)
    #expect(try store.drawing(sessionID: session, document: restored.worksheet, page: 0) == Data([9, 8]))
}

@Test func lessonOrderPersistsWithoutChangingDocumentOwnershipOrAcceptingForeignIDs() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let tutor = UUID(), store = try LessonStore(root: root, tutorID: tutor), session = UUID()
    for title in ["Test 1.pdf", "Test 2.pdf", "Test 3.pdf"] {
        let resource = TeachingResource(id: UUID(), topicID: UUID(), topicName: "Topic", subjectID: UUID(), subjectName: "Subject",
            worksheet: TeachingDocument(id: UUID(), title: title, mimeType: "application/pdf", externalURL: nil), solutions: nil)
        _ = try store.add(resource, to: session, worksheet: Data([1]), solutions: nil)
    }
    let original = try store.lesson(sessionID: session).resources
    let order = [original[2].id, original[0].id, original[1].id]
    _ = try store.reorder(order, in: session)
    let reopened = try LessonStore(root: root, tutorID: tutor).lesson(sessionID: session)
    #expect(reopened.resources.map(\.id) == order)
    #expect(reopened.resources[0].worksheet.id == original[2].worksheet.id)
    #expect(throws: (any Error).self) { try store.reorder([UUID(), original[0].id, original[1].id], in: session) }
    #expect(try store.lesson(sessionID: session).resources.map(\.id) == order)
}
