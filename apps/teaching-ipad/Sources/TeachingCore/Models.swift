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
    public let resourceType: String?
    public let resourceIndex: Int?
    public let worksheet: TeachingDocument
    public let solutions: TeachingDocument?
    public init(id: UUID, topicID: UUID, topicName: String, subjectID: UUID, subjectName: String,
                worksheet: TeachingDocument, solutions: TeachingDocument?, resourceType: String? = nil, resourceIndex: Int? = nil) {
        self.id = id; self.topicID = topicID; self.topicName = topicName; self.subjectID = subjectID
        self.resourceType = resourceType; self.resourceIndex = resourceIndex
        self.subjectName = subjectName; self.worksheet = worksheet; self.solutions = solutions
    }
}

/// Shared preparation intent; each Tutor imports it into their own local lesson.
public struct SessionPlanTopic: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let name: String
    public let code: String?
    public init(id: UUID, name: String, code: String? = nil) {
        self.id = id; self.name = name; self.code = code
    }
}

public struct SessionLessonPlan: Codable, Sendable {
    public let sessionID: UUID
    public let revision: Int
    public let topics: [SessionPlanTopic]
    public let resources: [TeachingResource]
    public init(sessionID: UUID, revision: Int, topics: [SessionPlanTopic], resources: [TeachingResource]) {
        self.sessionID = sessionID; self.revision = revision; self.topics = topics; self.resources = resources
    }
}

public struct CachedDocument: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let source: TeachingDocument
}

public struct LessonResource: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let workspaceID: UUID?
    public var syncID: UUID { workspaceID ?? resource?.id ?? id }
    /// Absent for imported and blank local documents; never invent catalog identity.
    public let resource: TeachingResource?
    public let worksheet: CachedDocument
    public let solutions: CachedDocument?

    init(id: UUID, workspaceID: UUID? = nil, resource: TeachingResource?, worksheet: CachedDocument, solutions: CachedDocument?) {
        self.id = id; self.workspaceID = workspaceID; self.resource = resource
        self.worksheet = worksheet; self.solutions = solutions
    }
}

public struct LessonRecord: Codable, Sendable {
    public let sessionID: UUID
    public var resources: [LessonResource] = []
    public var draft: LessonDraft = LessonDraft()
    public var archivedResources: [LessonResource] = []
    public var plannedTopics: [SessionPlanTopic] = []
    public var plannedRevision: Int = 0
    public var importedPlanResourceIDs: Set<UUID> = []
    public init(sessionID: UUID) { self.sessionID = sessionID }
    private enum CodingKeys: String, CodingKey { case sessionID, resources, draft, archivedResources, plannedTopics, plannedRevision, importedPlanResourceIDs }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        sessionID = try values.decode(UUID.self, forKey: .sessionID)
        resources = try values.decode([LessonResource].self, forKey: .resources)
        draft = try values.decode(LessonDraft.self, forKey: .draft)
        archivedResources = try values.decodeIfPresent([LessonResource].self, forKey: .archivedResources) ?? []
        plannedTopics = try values.decodeIfPresent([SessionPlanTopic].self, forKey: .plannedTopics) ?? []
        plannedRevision = try values.decodeIfPresent(Int.self, forKey: .plannedRevision) ?? 0
        importedPlanResourceIDs = try values.decodeIfPresent(Set<UUID>.self, forKey: .importedPlanResourceIDs) ?? []
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
    public var submissionID = UUID()
    public var excludedResources: Set<UUID> = []
    public var excludedAnnotations: Set<UUID> = []
    public var studentAssignments: [UUID: [UUID]] = [:]
    public var studentAttendance: [UUID: Bool] = [:]
    public var staffAttendance: [UUID: Bool] = [:]
    public var parentAttendance: [UUID: Bool] = [:]
    public var notes: String = ""
    public init() {}
    public mutating func setResourceIncluded(_ id: UUID, included: Bool) {
        if included { excludedResources.remove(id) }
        else { excludedResources.insert(id); excludedAnnotations.insert(id) }
    }
    public mutating func setAnnotationIncluded(_ id: UUID, included: Bool) {
        if included { excludedAnnotations.remove(id); excludedResources.remove(id) }
        else { excludedAnnotations.insert(id) }
    }
    private enum CodingKeys: String, CodingKey {
        case submissionID, excludedResources, excludedAnnotations, studentAssignments, studentAttendance, staffAttendance, parentAttendance, notes
    }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        submissionID = try values.decodeIfPresent(UUID.self, forKey: .submissionID) ?? UUID()
        excludedResources = try values.decodeIfPresent(Set<UUID>.self, forKey: .excludedResources) ?? []
        excludedAnnotations = (try values.decodeIfPresent(Set<UUID>.self, forKey: .excludedAnnotations) ?? []).union(excludedResources)
        studentAssignments = try values.decodeIfPresent([UUID: [UUID]].self, forKey: .studentAssignments) ?? [:]
        studentAttendance = try values.decodeIfPresent([UUID: Bool].self, forKey: .studentAttendance) ?? [:]
        staffAttendance = try values.decodeIfPresent([UUID: Bool].self, forKey: .staffAttendance) ?? [:]
        parentAttendance = try values.decodeIfPresent([UUID: Bool].self, forKey: .parentAttendance) ?? [:]
        notes = try values.decodeIfPresent(String.self, forKey: .notes) ?? ""
    }
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
