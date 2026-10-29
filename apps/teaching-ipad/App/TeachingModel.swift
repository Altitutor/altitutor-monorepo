import SwiftUI
import TeachingCore
import PDFKit

@MainActor final class TeachingModel: ObservableObject {
    let api = TeachingAPI()
    @Published var profile: TutorProfile?
    @Published var sessions: [TeachingSession] = []
    @Published var selectedDate = Date()
    @Published var selectedSessionID: UUID?
    @Published var lesson: LessonRecord?
    @Published var activeResourceID: UUID?
    @Published var viewer = false
    @Published var solutions = false
    @Published var fingerDrawing = false
    @Published var busy = false
    @Published var offline = false
    @Published var error: String?
    @Published var catalog: [TeachingResource] = []
    @Published var nextOffset: Int?
    @Published var libraryBusy = false
    @Published var sharedURL: URL?
    private(set) var store: LessonStore?
    private var epoch = 0
    var session: TeachingSession? { sessions.first { $0.id == selectedSessionID } }
    var activeResource: LessonResource? { lesson?.resources.first { $0.id == activeResourceID } }
    static var calendar: Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Australia/Adelaide")!; return c }
    static func day(_ date: Date) -> String {
        let f = DateFormatter(); f.calendar = calendar; f.timeZone = calendar.timeZone; f.dateFormat = "yyyy-MM-dd"; return f.string(from: date)
    }
    static func time(_ date: Date) -> String {
        let f = DateFormatter(); f.timeZone = calendar.timeZone; f.dateStyle = .none; f.timeStyle = .short; return f.string(from: date)
    }
    func start() async {
        try? FileManager.default.removeItem(at: AnnotatedPDF.exportsDirectory)
        do {
            if let restored = try api.restore() { try install(restored); await loadSessions() }
        } catch { self.error = error.localizedDescription }
    }
    func signIn(email: String, password: String) async {
        busy = true; defer { busy = false }
        do { let profile = try await api.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password); try install(profile); await loadSessions() }
        catch { report(error) }
    }
    private func install(_ tutor: TutorProfile) throws {
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        var root = support.appendingPathComponent("Teaching/" + api.namespace, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        var values = URLResourceValues(); values.isExcludedFromBackup = true; try root.setResourceValues(values)
        store = try LessonStore(root: root, tutorID: tutor.id); profile = tutor
    }
    func signOut() {
        do {
            try api.signOut(); epoch += 1
            ClassroomState.shared.clear(); profile = nil; sessions = []; lesson = nil; selectedSessionID = nil
            activeResourceID = nil; store = nil; catalog = []; sharedURL = nil; viewer = false; solutions = false; offline = false
        } catch { self.error = error.localizedDescription }
    }
    func report(_ error: Error) {
        if error is CancellationError { return }
        if let failure = error as? APIError, failure.status == 401 {
            signOut()
        }
        self.error = error.localizedDescription
    }
    func loadSessions() async {
        guard let store, profile != nil else { return }
        let version = epoch, day = Self.day(selectedDate)
        busy = true; defer { if epoch == version { busy = false } }
        do {
            let fresh: [TeachingSession] = try await api.request("sessions", query: [.init(name: "day", value: day)])
            guard version == epoch, day == Self.day(selectedDate) else { return }
            var cache = (try store.cachedSessions()).flatMap { try? TeachingAPI.decoder.decode([TeachingSession].self, from: $0) } ?? []
            cache.removeAll { Self.day($0.startAt) == day }; cache.append(contentsOf: fresh)
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            try store.saveSessions(encoder.encode(cache)); sessions = fresh; offline = false
            if let id = selectedSessionID, !fresh.contains(where: { $0.id == id }) { leaveLesson() }
        } catch {
            guard epoch == version else { return }
            if let failure = error as? APIError, failure.status == 401 || failure.status == 403 { signOut(); report(error); return }
            if let data = try? store.cachedSessions(), let cached = try? TeachingAPI.decoder.decode([TeachingSession].self, from: data) {
                sessions = cached.filter { Self.day($0.startAt) == day }; offline = true
            } else { report(error) }
        }
    }
    func choose(_ session: TeachingSession) {
        do {
            guard let store else { return }
            selectedSessionID = session.id; lesson = try store.lesson(sessionID: session.id)
            activeResourceID = lesson?.resources.first?.id; viewer = activeResourceID != nil; solutions = false
            showLessonInformation(); allowActiveWorksheet()
        } catch { report(error) }
    }
    func showLessonInformation() {
        guard let session, let profile else { ClassroomState.shared.clear(); return }
        ClassroomState.shared.showLesson(title: session.classroomTitle, time: "\(Self.time(session.startAt))–\(Self.time(session.endAt))", room: session.room ?? "", tutor: profile.name)
    }
    func leaveLesson() { selectedSessionID = nil; lesson = nil; activeResourceID = nil; viewer = false; ClassroomState.shared.clear() }
    func allowActiveWorksheet() {
        if viewer, let item = activeResource, item.resource.worksheet.isPDF, item.resource.worksheet.externalURL == nil {
            ClassroomState.shared.allowWorksheet(item.worksheet.id)
        }
    }
    func open(_ item: LessonResource) { activeResourceID = item.id; viewer = true; showLessonInformation(); allowActiveWorksheet() }
    func showBoard() { viewer = false; showLessonInformation() }
    func search(_ text: String, allSubjects: Bool, more: Bool = false) async {
        guard let session else { return }
        let version = epoch, sessionID = session.id
        let offset = more ? nextOffset ?? 0 : 0
        if !more { catalog = [] }
        libraryBusy = true; defer { if version == epoch { libraryBusy = false } }
        do {
            var query = [URLQueryItem(name: "query", value: text), .init(name: "offset", value: String(offset))]
            if !allSubjects, let subject = session.subjectID { query.append(.init(name: "subjectID", value: subject.uuidString)) }
            let page: ResourcePage = try await api.request("resources", query: query)
            try Task.checkCancellation()
            guard version == epoch, selectedSessionID == sessionID else { return }
            catalog = more ? catalog + page.resources : page.resources; nextOffset = page.nextOffset
        } catch { if !Task.isCancelled { report(error) } }
    }
    func add(_ resource: TeachingResource, freshCopy: Bool = false) async {
        guard let store, let session else { return }
        if !freshCopy, let existing = lesson?.resources.first(where: { $0.resource.id == resource.id }) { open(existing); return }
        let version = epoch
        busy = true; defer { if version == epoch { busy = false } }
        do {
            var resource = resource
            if freshCopy {
                let latest: ResourcePage = try await api.request("resources", query: [.init(name: "resourceID", value: resource.id.uuidString)])
                guard let current = latest.resources.first else { throw APIError(status: 404, message: "This resource is no longer accessible.") }
                resource = current
            }
            let primary = try await api.download(resource.worksheet)
            var answers: Data?
            if let source = resource.solutions { answers = try await api.download(source) }
            guard version == epoch, selectedSessionID == session.id else { return }
            if resource.worksheet.isPDF, resource.worksheet.externalURL == nil, PDFDocument(data: primary) == nil { throw APIError(status: 0, message: "This resource is not a readable PDF.") }
            lesson = try store.add(resource, to: session.id, worksheet: primary, solutions: answers, freshCopy: freshCopy)
            if activeResourceID == nil || freshCopy { activeResourceID = lesson?.resources.last?.id; allowActiveWorksheet() }
        } catch { report(error) }
    }
    func addStudent(_ student: Participant) async {
        guard let session else { return }
        struct Input: Encodable { let sessionId: UUID; let studentId: UUID }
        struct Result: Decodable { let success: Bool }
        busy = true; defer { busy = false }
        do {
            let _: Result = try await api.request("students", body: JSONEncoder().encode(Input(sessionId: session.id, studentId: student.id)))
            await loadSessions()
        } catch { report(error) }
    }
    func saveDraft(_ draft: LessonDraft) {
        guard let store, let session else { return }
        do { try store.saveDraft(draft, sessionID: session.id); lesson = try store.lesson(sessionID: session.id) }
        catch { report(error) }
    }
    func submitLog() async -> Bool {
        guard let session, let profile, let store, let draft = lesson?.draft, profile.canSubmitLogs else { return false }
        guard session.students.allSatisfy({ draft.studentAttendance[$0.id] != nil }), session.staff.allSatisfy({ draft.staffAttendance[$0.id] != nil }),
              session.parents.allSatisfy({ draft.parentAttendance[$0.id] != nil }) else { error = "Confirm attendance for every participant."; return false }
        let version = epoch
        busy = true; defer { if version == epoch { busy = false } }
        do {
            let suggestions = try store.logSuggestions(sessionID: session.id, attendingStudents: session.students.filter { draft.studentAttendance[$0.id] == true }.map(\.id))
            struct StaffAttendance: Encodable { let staffId: UUID; let attended: Bool; let type: String }
            struct StudentAttendance: Encodable { let studentId: UUID; let attended: Bool }
            struct ParentAttendance: Encodable { let parentId: UUID; let attended: Bool }
            struct Input: Encodable {
                let sessionId: UUID; let staffAttendance: [StaffAttendance]; let studentAttendance: [StudentAttendance]
                let parentAttendance: [ParentAttendance]; let topics: [TopicSelection]; let topicFiles: [FileSelection]; let notes: [String]
            }
            let input = Input(sessionId: session.id,
                staffAttendance: session.staff.map { StaffAttendance(staffId: $0.id, attended: draft.staffAttendance[$0.id] == true, type: $0.type) },
                studentAttendance: session.students.map { StudentAttendance(studentId: $0.id, attended: draft.studentAttendance[$0.id] == true) },
                parentAttendance: session.parents.map { ParentAttendance(parentId: $0.id, attended: draft.parentAttendance[$0.id] == true) },
                topics: suggestions.topics, topicFiles: suggestions.topicFiles, notes: draft.notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? [] : [draft.notes])
            struct Result: Decodable { let success: Bool }
            let result: Result = try await api.request("logs", body: JSONEncoder().encode(input))
            guard version == epoch else { return false }
            if result.success { await loadSessions(); return true }
            return false
        } catch { report(error); return false }
    }
    func finishSharing() {
        if let url = sharedURL, url.isFileURL, url.deletingLastPathComponent().deletingLastPathComponent() == AnnotatedPDF.exportsDirectory {
            try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
        }
        sharedURL = nil
    }
    func share(_ document: CachedDocument) {
        guard let store, let session else { return }
        NotificationCenter.default.post(name: Notification.Name("TeachingFlushPDF"), object: nil)
        do { sharedURL = try AnnotatedPDF.export(document, sessionID: session.id, store: store) }
        catch { report(error) }
    }
}
