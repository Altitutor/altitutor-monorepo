import Foundation
import Testing
@testable import TeachingCore

@Test func importedDocumentsReopenWithoutBecomingTutorLogSuggestions() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let tutor = UUID(), session = UUID(), student = UUID()
    let store = try LessonStore(root: root, tutorID: tutor)
    let bytes = Data("local PDF snapshot".utf8)
    let record = try store.addLocalDocument(title: "My notes.pdf", to: session, pdf: bytes)
    let imported = try #require(record.resources.first)
    let reopened = try LessonStore(root: root, tutorID: tutor)
    #expect(try reopened.lesson(sessionID: session).resources.first?.id == imported.id)
    #expect(try Data(contentsOf: reopened.documentURL(sessionID: session, document: imported.worksheet)) == bytes)
    let suggestions = try reopened.logSuggestions(sessionID: session, attendingStudents: [student])
    #expect(suggestions.topics.isEmpty)
    #expect(suggestions.topicFiles.isEmpty)
}

@Test func importedDocumentsAndInkStayWithTheirTutorAndSession() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let tutor = UUID(), session = UUID(), otherSession = UUID()
    let store = try LessonStore(root: root, tutorID: tutor)
    let added = try #require(store.addLocalDocument(title: "Lesson notes.pdf", to: session, pdf: Data([1, 2])).resources.first)
    try store.saveDrawing(Data([3, 4]), sessionID: session, document: added.worksheet, page: 0)
    let reopened = try LessonStore(root: root, tutorID: tutor)
    #expect(try reopened.drawing(sessionID: session, document: added.worksheet, page: 0) == Data([3, 4]))
    #expect(try reopened.lesson(sessionID: otherSession).resources.isEmpty)
    #expect(throws: (any Error).self) { try reopened.documentURL(sessionID: otherSession, document: added.worksheet) }
    let otherTutor = try LessonStore(root: root, tutorID: UUID())
    #expect(try otherTutor.lesson(sessionID: session).resources.isEmpty)
    #expect(throws: (any Error).self) { try otherTutor.documentURL(sessionID: session, document: added.worksheet) }
}

@Test func importedAndCatalogDocumentsKeepTheirCombinedTabOrderAfterReopening() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let tutor = UUID(), session = UUID(), store = try LessonStore(root: root, tutorID: tutor)
    let first = try #require(store.addLocalDocument(title: "Notes.pdf", to: session, pdf: Data([1])).resources.first)
    let catalog = TeachingResource(id: UUID(), topicID: UUID(), topicName: "Algebra", subjectID: UUID(), subjectName: "Maths",
        worksheet: TeachingDocument(id: UUID(), title: "Practice.pdf", mimeType: "application/pdf", externalURL: nil), solutions: nil)
    let second = try #require(store.add(catalog, to: session, worksheet: Data([2]), solutions: nil).resources.last)
    let third = try #require(store.addLocalDocument(title: "Blank.pdf", to: session, pdf: Data([3])).resources.last)
    _ = try store.reorder([third.id, first.id, second.id], in: session)
    let reopened = try LessonStore(root: root, tutorID: tutor)
    #expect(try reopened.lesson(sessionID: session).resources.map(\.id) == [third.id, first.id, second.id])
    #expect(try reopened.logSuggestions(sessionID: session, attendingStudents: []).topicFiles.map(\.topicsFilesId) == [catalog.worksheet.id])
}
