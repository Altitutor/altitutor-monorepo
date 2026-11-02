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
        if !freshCopy, let index = record.archivedResources.lastIndex(where: { $0.resource.id == resource.id }) {
            record.resources.append(record.archivedResources.remove(at: index))
            try write(JSONEncoder().encode(record), to: folder(sessionID).appendingPathComponent("lesson.json"))
            return record
        }
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

    @discardableResult
    public func remove(_ resourceID: UUID, from sessionID: UUID) throws -> LessonRecord {
        var record = try lesson(sessionID: sessionID)
        guard let index = record.resources.firstIndex(where: { $0.id == resourceID }) else { throw CocoaError(.fileReadNoPermission) }
        record.archivedResources.append(record.resources.remove(at: index))
        record.draft.excludedResources.remove(resourceID)
        record.draft.studentAssignments.removeValue(forKey: resourceID)
        try write(JSONEncoder().encode(record), to: folder(sessionID).appendingPathComponent("lesson.json"))
        return record
    }

    @discardableResult
    public func reorder(_ resourceIDs: [UUID], in sessionID: UUID) throws -> LessonRecord {
        var record = try lesson(sessionID: sessionID)
        guard resourceIDs.count == record.resources.count,
              Set(resourceIDs) == Set(record.resources.map(\.id)) else { throw CocoaError(.fileWriteInvalidFileName) }
        let byID = Dictionary(uniqueKeysWithValues: record.resources.map { ($0.id, $0) })
        record.resources = resourceIDs.compactMap { byID[$0] }
        try write(JSONEncoder().encode(record), to: folder(sessionID).appendingPathComponent("lesson.json"))
        return record
    }

    public func documentURL(sessionID: UUID, document: CachedDocument) throws -> URL {
        let record = try lesson(sessionID: sessionID)
        guard record.resources.contains(where: { $0.worksheet.id == document.id || $0.solutions?.id == document.id }) else {
            throw CocoaError(.fileReadNoPermission)
        }
        let url = try documentFolder(sessionID: sessionID, document: document).appendingPathComponent(document.id.uuidString + ".pdf")
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
        guard page >= 0 else { throw CocoaError(.fileReadInvalidFileName) }
        let url = try drawingURL(sessionID: sessionID, document: document, page: page)
        return files.fileExists(atPath: url.path) ? try Data(contentsOf: url) : nil
    }

    public func saveViewport(_ viewport: DocumentViewport, sessionID: UUID, document: CachedDocument) throws {
        _ = try documentURL(sessionID: sessionID, document: document)
        try write(JSONEncoder().encode(viewport), to: documentFolder(sessionID: sessionID, document: document).appendingPathComponent(document.id.uuidString + ".viewport.json"))
    }

    public func viewport(sessionID: UUID, document: CachedDocument) throws -> DocumentViewport {
        _ = try documentURL(sessionID: sessionID, document: document)
        let url = try documentFolder(sessionID: sessionID, document: document).appendingPathComponent(document.id.uuidString + ".viewport.json")
        return files.fileExists(atPath: url.path) ? try JSONDecoder().decode(DocumentViewport.self, from: Data(contentsOf: url)) : DocumentViewport()
    }

    /// Commit PDF bytes, rebased ink and position together; the pinned original is never overwritten.
    @discardableResult
    public func editPages(_ edit: DocumentPageEdit, pdf: Data, pageCount: Int, sessionID: UUID, document: CachedDocument) throws -> DocumentViewport {
        let previous = try documentURL(sessionID: sessionID, document: document).deletingLastPathComponent()
        guard document.source.isPDF, document.source.externalURL == nil, !pdf.isEmpty, pageCount > 0 else { throw CocoaError(.fileWriteInvalidFileName) }
        var viewport = try viewport(sessionID: sessionID, document: document)
        viewport.page = min(max(viewport.page, 0), pageCount - 1)
        let target: Int
        switch edit {
        case .insertBlank(let index):
            guard (0...pageCount).contains(index) else { throw CocoaError(.fileWriteInvalidFileName) }
            target = index
            viewport = DocumentViewport(page: index, rotation: viewport.rotation)
        case .delete(let index):
            guard pageCount > 1, (0..<pageCount).contains(index) else { throw CocoaError(.fileWriteInvalidFileName) }
            target = index
            if viewport.page == index { viewport = DocumentViewport(page: min(index, pageCount - 2), rotation: viewport.rotation) }
            else if viewport.page > index { viewport.page -= 1 }
        }
        let revision = UUID()
        let base = folder(sessionID).appendingPathComponent(document.id.uuidString + "-revisions", isDirectory: true).appendingPathComponent(revision.uuidString, isDirectory: true)
        do {
            try files.createDirectory(at: base, withIntermediateDirectories: true)
            try write(pdf, to: base.appendingPathComponent(document.id.uuidString + ".pdf"))
            for index in 0..<pageCount {
                let destination: Int
                switch edit {
                case .insertBlank: destination = index >= target ? index + 1 : index
                case .delete:
                    if index == target { continue }
                    destination = index > target ? index - 1 : index
                }
                if let ink = try drawing(sessionID: sessionID, document: document, page: index) {
                    try write(ink, to: base.appendingPathComponent("\(document.id.uuidString)-\(destination).drawing"))
                }
            }
            try write(JSONEncoder().encode(viewport), to: base.appendingPathComponent(document.id.uuidString + ".viewport.json"))
            // Only this final atomic pointer exposes the staged revision to readers.
            try write(JSONEncoder().encode(revision), to: folder(sessionID).appendingPathComponent(document.id.uuidString + ".revision.json"))
            // Bound disk growth: keep the current and immediately previous revisions, plus the pinned original.
            if let older = try? files.contentsOfDirectory(at: base.deletingLastPathComponent(), includingPropertiesForKeys: nil) {
                for candidate in older where candidate.lastPathComponent != revision.uuidString && candidate.lastPathComponent != previous.lastPathComponent && UUID(uuidString: candidate.lastPathComponent) != nil {
                    try? files.removeItem(at: candidate)
                }
            }
            return viewport
        } catch {
            try? files.removeItem(at: base)
            throw error
        }
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
    private func documentFolder(sessionID: UUID, document: CachedDocument) throws -> URL {
        let base = folder(sessionID)
        let pointer = base.appendingPathComponent(document.id.uuidString + ".revision.json")
        guard files.fileExists(atPath: pointer.path) else { return base }
        let revision = try JSONDecoder().decode(UUID.self, from: Data(contentsOf: pointer))
        return base.appendingPathComponent(document.id.uuidString + "-revisions", isDirectory: true).appendingPathComponent(revision.uuidString, isDirectory: true)
    }
    private func drawingURL(sessionID: UUID, document: CachedDocument, page: Int) throws -> URL {
        try documentFolder(sessionID: sessionID, document: document).appendingPathComponent("\(document.id.uuidString)-\(page).drawing")
    }
    private func write(_ data: Data, to url: URL) throws {
        #if os(iOS)
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        #else
        try data.write(to: url, options: .atomic)
        #endif
    }
}
