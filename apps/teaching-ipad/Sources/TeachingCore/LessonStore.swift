import Foundation

/// One authenticated Tutor's local lesson material. All access is checked against the lesson manifest.
public final class LessonStore {
    private let directory: URL
    private let files = FileManager.default
    public init(root: URL, tutorID: UUID) throws {
        directory = root.appendingPathComponent(tutorID.uuidString, isDirectory: true)
        try files.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    public func lesson(sessionID: UUID) throws -> LessonRecord {
        let url = folder(sessionID).appendingPathComponent("lesson.json")
        guard files.fileExists(atPath: url.path) else { return LessonRecord(sessionID: sessionID) }
        return try JSONDecoder().decode(LessonRecord.self, from: Data(contentsOf: url))
    }

    @discardableResult
    public func add(_ resource: TeachingResource, to sessionID: UUID, worksheet: Data, solutions: Data?, freshCopy: Bool = false) throws -> LessonRecord {
        var record = try lesson(sessionID: sessionID)
        if !freshCopy && record.resources.contains(where: { $0.resource.id == resource.id }) { return record }
        let primary = CachedDocument(id: UUID(), source: resource.worksheet)
        let answer = resource.solutions.flatMap { source in solutions.map { _ in CachedDocument(id: UUID(), source: source) } }
        let target = folder(sessionID)
        try files.createDirectory(at: target, withIntermediateDirectories: true)
        try write(worksheet, to: target.appendingPathComponent(primary.id.uuidString + ".pdf"))
        if let answer, let solutions { try write(solutions, to: target.appendingPathComponent(answer.id.uuidString + ".pdf")) }
        record.resources.append(LessonResource(id: UUID(), resource: resource, worksheet: primary, solutions: answer))
        try write(JSONEncoder().encode(record), to: target.appendingPathComponent("lesson.json"))
        return record
    }

    public func documentURL(sessionID: UUID, document: CachedDocument) throws -> URL {
        let record = try lesson(sessionID: sessionID)
        guard record.resources.contains(where: { $0.worksheet.id == document.id || $0.solutions?.id == document.id }) else {
            throw CocoaError(.fileReadNoPermission)
        }
        let url = folder(sessionID).appendingPathComponent(document.id.uuidString + ".pdf")
        guard files.fileExists(atPath: url.path) else { throw CocoaError(.fileNoSuchFile) }
        return url
    }

    public func saveDrawing(_ data: Data, sessionID: UUID, document: CachedDocument, page: Int) throws {
        _ = try documentURL(sessionID: sessionID, document: document)
        guard page >= 0 else { throw CocoaError(.fileWriteInvalidFileName) }
        try write(data, to: drawingURL(sessionID: sessionID, document: document, page: page))
    }

    public func drawing(sessionID: UUID, document: CachedDocument, page: Int) throws -> Data? {
        _ = try documentURL(sessionID: sessionID, document: document)
        let url = drawingURL(sessionID: sessionID, document: document, page: page)
        return files.fileExists(atPath: url.path) ? try Data(contentsOf: url) : nil
    }

    public func saveViewport(_ viewport: DocumentViewport, sessionID: UUID, document: CachedDocument) throws {
        _ = try documentURL(sessionID: sessionID, document: document)
        try write(JSONEncoder().encode(viewport), to: folder(sessionID).appendingPathComponent(document.id.uuidString + ".viewport.json"))
    }

    public func viewport(sessionID: UUID, document: CachedDocument) throws -> DocumentViewport {
        _ = try documentURL(sessionID: sessionID, document: document)
        let url = folder(sessionID).appendingPathComponent(document.id.uuidString + ".viewport.json")
        return files.fileExists(atPath: url.path) ? try JSONDecoder().decode(DocumentViewport.self, from: Data(contentsOf: url)) : DocumentViewport()
    }

    public func saveDraft(_ draft: LessonDraft, sessionID: UUID) throws {
        var record = try lesson(sessionID: sessionID)
        record.draft = draft
        try files.createDirectory(at: folder(sessionID), withIntermediateDirectories: true)
        try write(JSONEncoder().encode(record), to: folder(sessionID).appendingPathComponent("lesson.json"))
    }

    public func logSuggestions(sessionID: UUID, attendingStudents: [UUID]) throws -> LogSuggestions {
        let record = try lesson(sessionID: sessionID)
        let attending = Set(attendingStudents)
        var topicStudents: [UUID: Set<UUID>] = [:]
        var selectedFiles: [UUID: FileSelection] = [:]
        for item in record.resources where !record.draft.excludedResources.contains(item.id) {
            let assigned = Set(record.draft.studentAssignments[item.id] ?? attendingStudents).intersection(attending)
            topicStudents[item.resource.topicID, default: []].formUnion(assigned)
            let fileStudents = assigned.union(selectedFiles[item.resource.id]?.studentIds ?? [])
            selectedFiles[item.resource.id] = FileSelection(topicsFilesId: item.resource.worksheet.id,
                topicId: item.resource.topicID, studentIds: fileStudents.sorted { $0.uuidString < $1.uuidString })
        }
        return LogSuggestions(topics: topicStudents.map { TopicSelection(topicId: $0.key,
            studentIds: $0.value.sorted { $0.uuidString < $1.uuidString }) }.sorted { $0.topicId.uuidString < $1.topicId.uuidString },
            topicFiles: selectedFiles.values.sorted { $0.topicsFilesId.uuidString < $1.topicsFilesId.uuidString })
    }

    public func saveSessions(_ data: Data) throws { try write(data, to: directory.appendingPathComponent("sessions.json")) }
    public func cachedSessions() throws -> Data? {
        let url = directory.appendingPathComponent("sessions.json")
        return files.fileExists(atPath: url.path) ? try Data(contentsOf: url) : nil
    }

    private func folder(_ sessionID: UUID) -> URL { directory.appendingPathComponent(sessionID.uuidString, isDirectory: true) }
    private func drawingURL(sessionID: UUID, document: CachedDocument, page: Int) -> URL {
        folder(sessionID).appendingPathComponent("\(document.id.uuidString)-\(page).drawing")
    }
    private func write(_ data: Data, to url: URL) throws {
        #if os(iOS)
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        #else
        try data.write(to: url, options: .atomic)
        #endif
    }
}
