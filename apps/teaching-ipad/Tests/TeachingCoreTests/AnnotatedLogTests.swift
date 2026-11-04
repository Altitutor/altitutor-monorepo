import Foundation
import Testing
@testable import TeachingCore

@Test func selectingAnAnnotationRequiresItsCanonicalResource() {
    let resource = UUID()
    var draft = LessonDraft()
    draft.setResourceIncluded(resource, included: false)
    #expect(draft.excludedAnnotations.contains(resource))
    draft.setAnnotationIncluded(resource, included: true)
    #expect(!draft.excludedResources.contains(resource))
    #expect(!draft.excludedAnnotations.contains(resource))
    draft.setResourceIncluded(resource, included: false)
    #expect(draft.excludedAnnotations.contains(resource))
}

@Test func annotationChoicesAndSubmissionIdentitySurviveReopening() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let tutor = UUID(), session = UUID(), file = UUID()
    let store = try LessonStore(root: root, tutorID: tutor)
    var draft = LessonDraft()
    let submissionID = draft.submissionID
    draft.setAnnotationIncluded(file, included: false)
    try store.saveDraft(draft, sessionID: session)
    let reopened = try LessonStore(root: root, tutorID: tutor).lesson(sessionID: session).draft
    #expect(reopened.submissionID == submissionID)
    #expect(reopened.excludedAnnotations.contains(file))
}
