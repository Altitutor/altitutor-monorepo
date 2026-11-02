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

@Test func insertingBlankPageMovesInkWithItsOriginalPageAndPersistsLocalRevision() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let tutor = UUID(), store = try LessonStore(root: root, tutorID: tutor), session = UUID()
    let resource = TeachingResource(id: UUID(), topicID: UUID(), topicName: "Topic", subjectID: UUID(), subjectName: "Subject",
        worksheet: TeachingDocument(id: UUID(), title: "Practice.pdf", mimeType: "application/pdf", externalURL: nil),
        solutions: TeachingDocument(id: UUID(), title: "Answers.pdf", mimeType: "application/pdf", externalURL: nil))
    let added = try #require(store.add(resource, to: session, worksheet: Data([1]), solutions: Data([2])).resources.first)
    let originalURL = try store.documentURL(sessionID: session, document: added.worksheet)
    try store.saveDrawing(Data([10]), sessionID: session, document: added.worksheet, page: 0)
    try store.saveDrawing(Data([20]), sessionID: session, document: added.worksheet, page: 1)
    try store.saveDrawing(Data([30]), sessionID: session, document: added.worksheet, page: 2)
    try store.saveViewport(DocumentViewport(page: 1, scale: 2, rotation: 90), sessionID: session, document: added.worksheet)
    let viewport = try store.editPages(.insertBlank(at: 1), pdf: Data([3]), pageCount: 3, sessionID: session, document: added.worksheet)
    #expect(viewport.page == 1 && viewport.scale == 0 && viewport.rotation == 90)
    let reopened = try LessonStore(root: root, tutorID: tutor)
    #expect(try reopened.drawing(sessionID: session, document: added.worksheet, page: 0) == Data([10]))
    #expect(try reopened.drawing(sessionID: session, document: added.worksheet, page: 1) == nil)
    #expect(try reopened.drawing(sessionID: session, document: added.worksheet, page: 2) == Data([20]))
    #expect(try reopened.drawing(sessionID: session, document: added.worksheet, page: 3) == Data([30]))
    #expect(try reopened.viewport(sessionID: session, document: added.worksheet) == viewport)
    #expect(try Data(contentsOf: reopened.documentURL(sessionID: session, document: added.worksheet)) == Data([3]))
    #expect(try Data(contentsOf: originalURL) == Data([1]))
    #expect(try Data(contentsOf: reopened.documentURL(sessionID: session, document: #require(added.solutions))) == Data([2]))
    #expect(throws: (any Error).self) { try reopened.editPages(.delete(at: 0), pdf: Data([4]), pageCount: 4, sessionID: UUID(), document: added.worksheet) }
    let other = try LessonStore(root: root, tutorID: UUID())
    #expect(throws: (any Error).self) { try other.editPages(.delete(at: 0), pdf: Data([4]), pageCount: 4, sessionID: session, document: added.worksheet) }
    _ = try reopened.editPages(.insertBlank(at: 4), pdf: Data([4]), pageCount: 4, sessionID: session, document: added.worksheet)
    _ = try reopened.editPages(.delete(at: 1), pdf: Data([5]), pageCount: 5, sessionID: session, document: added.worksheet)
    _ = try reopened.editPages(.delete(at: 3), pdf: Data([6]), pageCount: 4, sessionID: session, document: added.worksheet)
    #expect(try reopened.drawing(sessionID: session, document: added.worksheet, page: 1) == Data([20]))
    #expect(try reopened.drawing(sessionID: session, document: added.worksheet, page: 2) == Data([30]))
    #expect(try Data(contentsOf: reopened.documentURL(sessionID: session, document: added.worksheet)) == Data([6]))
    #expect(try Data(contentsOf: originalURL) == Data([1]))
}

@Test func deletingPageRebasesInkAndPositionWithoutDiscardingPinnedSource() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let tutor = UUID(), store = try LessonStore(root: root, tutorID: tutor), session = UUID()
    let resource = TeachingResource(id: UUID(), topicID: UUID(), topicName: "Topic", subjectID: UUID(), subjectName: "Subject",
        worksheet: TeachingDocument(id: UUID(), title: "Practice.pdf", mimeType: "application/pdf", externalURL: nil), solutions: nil)
    let item = try #require(store.add(resource, to: session, worksheet: Data([1]), solutions: nil).resources.first)
    let pinned = try store.documentURL(sessionID: session, document: item.worksheet)
    try store.saveDrawing(Data([10]), sessionID: session, document: item.worksheet, page: 0)
    try store.saveDrawing(Data([20]), sessionID: session, document: item.worksheet, page: 1)
    try store.saveDrawing(Data([30]), sessionID: session, document: item.worksheet, page: 2)
    try store.saveViewport(DocumentViewport(page: 2, x: 10, y: 20, scale: 2), sessionID: session, document: item.worksheet)
    let viewport = try store.editPages(.delete(at: 1), pdf: Data([2]), pageCount: 3, sessionID: session, document: item.worksheet)
    #expect(viewport == DocumentViewport(page: 1, x: 10, y: 20, scale: 2))
    let reopened = try LessonStore(root: root, tutorID: tutor)
    #expect(try reopened.drawing(sessionID: session, document: item.worksheet, page: 0) == Data([10]))
    #expect(try reopened.drawing(sessionID: session, document: item.worksheet, page: 1) == Data([30]))
    #expect(try reopened.drawing(sessionID: session, document: item.worksheet, page: 2) == nil)
    #expect(try Data(contentsOf: pinned) == Data([1]))
    #expect(throws: (any Error).self) { try reopened.editPages(.delete(at: 0), pdf: Data([3]), pageCount: 1, sessionID: session, document: item.worksheet) }
    #expect(throws: (any Error).self) { try reopened.editPages(.insertBlank(at: -1), pdf: Data([3]), pageCount: 2, sessionID: session, document: item.worksheet) }
    #expect(throws: (any Error).self) { try reopened.editPages(.delete(at: 0), pdf: Data(), pageCount: 2, sessionID: session, document: item.worksheet) }
    #expect(try Data(contentsOf: reopened.documentURL(sessionID: session, document: item.worksheet)) == Data([2]))
}

@Test func pageEditWriteFailureLeavesCurrentPdfInkAndPositionUntouched() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let store = try LessonStore(root: root, tutorID: UUID()), session = UUID()
    let resource = TeachingResource(id: UUID(), topicID: UUID(), topicName: "Topic", subjectID: UUID(), subjectName: "Subject",
        worksheet: TeachingDocument(id: UUID(), title: "Practice.pdf", mimeType: "application/pdf", externalURL: nil), solutions: nil)
    let item = try #require(store.add(resource, to: session, worksheet: Data([1]), solutions: nil).resources.first)
    let pinned = try store.documentURL(sessionID: session, document: item.worksheet)
    try store.saveDrawing(Data([10]), sessionID: session, document: item.worksheet, page: 0)
    let viewport = DocumentViewport(page: 0, scale: 2)
    try store.saveViewport(viewport, sessionID: session, document: item.worksheet)
    let folder = pinned.deletingLastPathComponent()
    try FileManager.default.setAttributes([.posixPermissions: 0o500], ofItemAtPath: folder.path)
    defer { try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: folder.path) }
    #expect(throws: (any Error).self) { try store.editPages(.insertBlank(at: 0), pdf: Data([2]), pageCount: 1, sessionID: session, document: item.worksheet) }
    #expect(try store.documentURL(sessionID: session, document: item.worksheet) == pinned)
    #expect(try Data(contentsOf: pinned) == Data([1]))
    #expect(try store.drawing(sessionID: session, document: item.worksheet, page: 0) == Data([10]))
    #expect(try store.viewport(sessionID: session, document: item.worksheet) == viewport)
}
