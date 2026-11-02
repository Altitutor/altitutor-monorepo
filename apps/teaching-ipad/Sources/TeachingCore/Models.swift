import Foundation

public struct TeachingDocument: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let title: String
    public let code: String?
    public let mimeType: String
    public let externalURL: URL?
    public init(id: UUID, title: String, mimeType: String, externalURL: URL?, code: String? = nil) {
        self.id = id; self.title = title; self.code = code; self.mimeType = mimeType; self.externalURL = externalURL
    }
    public var displayTitle: String { [code, title].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ") }
    public var isPDF: Bool { mimeType == "application/pdf" || title.lowercased().hasSuffix(".pdf") }
}

public struct TeachingResource: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let topicID: UUID
    public let topicName: String
    public let subjectID: UUID
    public let subjectName: String
    public let worksheet: TeachingDocument
    public let solutions: TeachingDocument?
    public init(id: UUID, topicID: UUID, topicName: String, subjectID: UUID, subjectName: String,
                worksheet: TeachingDocument, solutions: TeachingDocument?) {
        self.id = id; self.topicID = topicID; self.topicName = topicName; self.subjectID = subjectID
        self.subjectName = subjectName; self.worksheet = worksheet; self.solutions = solutions
    }
}

public struct CachedDocument: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let source: TeachingDocument
}

public struct LessonResource: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let resource: TeachingResource
    public let worksheet: CachedDocument
    public let solutions: CachedDocument?
}

public struct LessonRecord: Codable, Sendable {
    public let sessionID: UUID
    public var resources: [LessonResource] = []
    public var draft: LessonDraft = LessonDraft()
    public var archivedResources: [LessonResource] = []
    public init(sessionID: UUID) { self.sessionID = sessionID }
    private enum CodingKeys: String, CodingKey { case sessionID, resources, draft, archivedResources }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        sessionID = try values.decode(UUID.self, forKey: .sessionID)
        resources = try values.decode([LessonResource].self, forKey: .resources)
        draft = try values.decode(LessonDraft.self, forKey: .draft)
        archivedResources = try values.decodeIfPresent([LessonResource].self, forKey: .archivedResources) ?? []
    }
}

public struct DocumentViewport: Codable, Equatable, Sendable {
    public var page: Int
    public var x: Double
    public var y: Double
    public var scale: Double
    public var rotation: Int
    public init(page: Int = 0, x: Double = 0, y: Double = 0, scale: Double = 0, rotation: Int = 0) {
        self.page = page; self.x = x; self.y = y; self.scale = scale; self.rotation = rotation
    }
}

public enum DocumentPageEdit: Sendable {
    case insertBlank(at: Int)
    case delete(at: Int)
}

public struct LessonDraft: Codable, Sendable {
    public var excludedResources: Set<UUID> = []
    public var studentAssignments: [UUID: [UUID]] = [:]
    public var studentAttendance: [UUID: Bool] = [:]
    public var staffAttendance: [UUID: Bool] = [:]
    public var parentAttendance: [UUID: Bool] = [:]
    public var notes: String = ""
    public init() {}
}

public struct TopicSelection: Codable, Sendable {
    public let topicId: UUID
    public let studentIds: [UUID]
}
public struct FileSelection: Codable, Sendable {
    public let topicsFilesId: UUID
    public let topicId: UUID
    public let studentIds: [UUID]
}
public struct LogSuggestions: Sendable {
    public let topics: [TopicSelection]
    public let topicFiles: [FileSelection]
}
