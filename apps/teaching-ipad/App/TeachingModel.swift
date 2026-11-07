import SwiftUI
import TeachingCore
import PDFKit
import UniformTypeIdentifiers

struct LessonAnnotationCandidate: Identifiable {
    let item: LessonResource
    let snapshot: TeachingPDFSnapshot?
    let failure: String?
    var id: UUID { item.id }
}

enum TeachingRoute: Hashable { case lesson(UUID), document }

@MainActor final class TeachingModel: ObservableObject {
    let api = TeachingAPI()
    @Published var staffDirectory: [StaffLogin] = []
    @Published var profile: TutorProfile?
    @Published var sessions: [TeachingSession] = []
    @Published var selectedDate = Date()
    @Published var selectedSessionID: UUID?
    @Published var lesson: LessonRecord?
    @Published var activeResourceID: UUID?
    @Published var route: [TeachingRoute] = []
    @Published var viewer = false
    @Published var solutions = false
    @Published var laserMode = TeachingLaserMode.off
    @Published var pageSidebar = false
    @Published var documentRevision = UUID()
    @Published var busy = false
    @Published var offline = false
    @Published var error: String?
    @Published var catalog: [TeachingResource] = []
    @Published var librarySubjects: [LibrarySubject] = []
    @Published var librarySubjectID: UUID?
    @Published var resourceCodes: [UUID: String] = [:]
    @Published var printNotice: String?
    @Published var printRequest: TeachingPrintRequest?
    @Published var annotationCandidates: [LessonAnnotationCandidate] = []
    @Published var annotationsReady = false
    private var printTasks: [UUID: Task<Void, Never>] = [:]
    private var planTask: Task<Void, Never>?
    private var workspaceUploads: [UUID: Task<Void, Never>] = [:]
    private var workspaceUploadsQueuedAgain = Set<UUID>()
    @Published private(set) var previousLesson: [PreviousLessonPDF] = []
    @Published private(set) var lessonRefreshError: String?
    private var libraryRequest = UUID()
    @Published var libraryTopics: [LibraryTopic] = []
    @Published var libraryBusy = false
    @Published var sharedURL: URL?
    @Published var suggestions: [TeachingResource] = []
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
            staffDirectory = try api.cachedStaffDirectory()
            if let restored = try api.restore() {
                try install(restored); await loadSessions()
                if profile != nil, restored.canSubmitLogs, !offline { staffDirectory = try await api.refreshStaffDirectory() }
            }
        } catch { self.error = error.localizedDescription }
    }
    func signIn(email: String, password: String) async {
        await signIn { try await self.api.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password) }
    }

    func signIn(staffID: UUID, pin: String) async {
        await signIn { try await self.api.signIn(staffID: staffID, pin: pin) }
    }

    private func signIn(_ authenticate: () async throws -> TutorProfile) async {
        guard !busy, profile == nil else { return }
        busy = true; defer { busy = false }
        do {
            let tutor = try await authenticate()
            guard tutor.canSubmitLogs else { throw APIError(status: 403, message: "An active staff account is required to set up or sign in on this office iPad.") }
            staffDirectory = try await api.refreshStaffDirectory()
            try install(tutor); await loadSessions()
        } catch {
            if profile == nil { try? api.signOut() }
            report(error)
        }
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
            planTask?.cancel(); planTask = nil; previousLesson = []; lessonRefreshError = nil
            for upload in workspaceUploads.values { upload.cancel() }
            workspaceUploads = [:]; workspaceUploadsQueuedAgain = []
            busy = false
            for task in printTasks.values { task.cancel() }; printTasks = [:]
            route = []; librarySubjects = []; librarySubjectID = nil; resourceCodes = [:]; printNotice = nil; printRequest = nil; annotationCandidates = []
            ClassroomState.shared.clear(); profile = nil; sessions = []; lesson = nil; selectedSessionID = nil
            activeResourceID = nil; store = nil; suggestions = []; catalog = []; libraryTopics = []; sharedURL = nil; viewer = false; solutions = false; pageSidebar = false; offline = false
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
            for pending in (try? store.pendingWorkspaceSessions()) ?? [] where workspaceUploads[pending] == nil {
                scheduleWorkspaceUpload(pending)
            }
        } catch {
            guard epoch == version else { return }
            if let failure = error as? APIError, failure.status == 401 || failure.status == 403 { signOut(); report(error); return }
            if let data = try? store.cachedSessions(), let cached = try? TeachingAPI.decoder.decode([TeachingSession].self, from: data) {
                sessions = cached.filter { Self.day($0.startAt) == day }; offline = true
            } else { report(error) }
        }
    }
    func choose(_ session: TeachingSession) {
        planTask?.cancel()
        laserMode = .off
        do {
            guard let store else { return }
            selectedSessionID = session.id; lesson = try store.lesson(sessionID: session.id)
            annotationCandidates = []; annotationsReady = false
            activeResourceID = lesson?.resources.first?.id; viewer = false; solutions = false; suggestions = []
            librarySubjectID = session.subjectID; route = [.lesson(session.id)]
            showLessonInformation(); allowActiveWorksheet()
            Task { await refreshResourceCodes() }
            previousLesson = []; lessonRefreshError = nil
            scheduleLessonRefresh()
        } catch { report(error) }
    }
    private func scheduleLessonRefresh() {
        guard let session, !offline else { return }
        planTask?.cancel()
        planTask = Task { await refreshLesson(session) }
    }

    func refreshLesson() async {
        guard let session else { return }
        if offline {
            await loadSessions()
            guard !offline, selectedSessionID == session.id else { return }
        }
        scheduleLessonRefresh()
        await planTask?.value
    }

    private func refreshLesson(_ session: TeachingSession) async {
        guard let store else { return }
        let version = epoch
        func verify() throws {
            try Task.checkCancellation()
            guard version == epoch, selectedSessionID == session.id else { throw CancellationError() }
        }
        do {
            let query = [URLQueryItem(name: "sessionID", value: session.id.uuidString)]
            let existing: [SyncedLessonResource] = try await api.request("workspace", query: query)
            try verify()
            let record = try store.lesson(sessionID: session.id)
            let localIDs = Set((record.resources + record.archivedResources).map(\.syncID))
            var missingOriginal = false
            var excludedPlanResources = Set<UUID>()
            for remote in existing where !localIDs.contains(remote.item.syncID) {
                try verify()
                do {
                    let worksheet = try await api.downloadWorkspacePDF(remote.worksheetArtifactID)
                    let solutions: Data?
                    if let id = remote.solutionsArtifactID { solutions = try await api.downloadWorkspacePDF(id) }
                    else { solutions = nil }
                    try verify()
                    try validateOriginal(worksheet)
                    if let solutions { try validateOriginal(solutions) }
                    lesson = try store.addOriginal(remote.item, to: session.id, worksheet: worksheet, solutions: solutions)
                    if activeResourceID == nil { activeResourceID = lesson?.resources.first?.id }
                } catch let failure as APIError where failure.status == 401 { throw failure }
                catch is CancellationError { return }
                catch {
                    missingOriginal = true
                    if let resourceID = remote.item.resource?.id, remote.item.syncID == resourceID {
                        excludedPlanResources.insert(resourceID)
                    }
                }
            }
            if ["CLASS", "DRAFTING", "EXAM_COURSE", "TRIAL_SESSION"].contains(session.kind) {
                await importSessionPlan(session.id, excluding: excludedPlanResources)
                try verify()
            }
            scheduleWorkspaceUpload(session.id)
            let previous: PreviousLessonResources? = try await api.request("previous-lesson", query: query)
            try verify()
            previousLesson = try previous.map { try previousDocuments($0, store: store) } ?? []
            lessonRefreshError = missingOriginal ? "Some lesson documents couldn’t download. Pull down to retry." : nil
        } catch {
            guard version == epoch, selectedSessionID == session.id, !Task.isCancelled, !(error is CancellationError) else { return }
            if let failure = error as? APIError, failure.status == 401 { report(error); return }
            lessonRefreshError = "Couldn’t refresh all lesson documents. Pull down to retry."
        }
    }

    // Uploads belong to the signed-in tutor, so backing out of a lesson does not
    // cancel work already accepted by the board. The manifest survives sign-out.
    var hasPendingWorkspaceSync: Bool {
        !workspaceUploads.isEmpty || ((try? store?.pendingWorkspaceSessions())?.isEmpty == false)
    }

    func syncBeforeLogout() async -> Bool {
        guard let store, profile != nil, !offline else { return false }
        let version = epoch
        for id in (try? store.pendingWorkspaceSessions()) ?? [] where workspaceUploads[id] == nil {
            scheduleWorkspaceUpload(id)
        }
        for task in Array(workspaceUploads.values) { await task.value }
        return version == epoch && !hasPendingWorkspaceSync
    }

    private func scheduleWorkspaceUpload(_ sessionID: UUID) {
        guard let store, profile != nil, !offline else { return }
        if workspaceUploads[sessionID] != nil {
            workspaceUploadsQueuedAgain.insert(sessionID)
            return
        }
        let version = epoch
        workspaceUploads[sessionID] = Task { [weak self] in
            guard let self else { return }
            defer {
                if version == epoch {
                    workspaceUploads[sessionID] = nil
                    if workspaceUploadsQueuedAgain.remove(sessionID) != nil { scheduleWorkspaceUpload(sessionID) }
                }
            }
            do {
                let existing: [SyncedLessonResource] = try await api.request("workspace",
                    query: [URLQueryItem(name: "sessionID", value: sessionID.uuidString)])
                try Task.checkCancellation()
                let remoteIDs = Set(existing.map { $0.item.syncID })
                try store.markWorkspaceSynced(sessionID: sessionID, ids: remoteIDs)
                let record = try store.lesson(sessionID: sessionID)
                var failed = false
                for item in record.resources where item.canSync && !remoteIDs.contains(item.syncID) {
                    try Task.checkCancellation()
                    do {
                        try await api.syncOriginal(item, sessionID: sessionID, store: store)
                        try Task.checkCancellation()
                        try store.markWorkspaceSynced(sessionID: sessionID, ids: [item.syncID])
                    } catch let failure as APIError where failure.status == 401 { throw failure }
                    catch is CancellationError { return }
                    catch { failed = true }
                }
                if failed, selectedSessionID == sessionID {
                    lessonRefreshError = "Some lesson documents couldn’t sync. Pull down to retry."
                }
            } catch {
                guard version == epoch, !Task.isCancelled, !(error is CancellationError) else { return }
                if let failure = error as? APIError, failure.status == 401 { report(error) }
                else if selectedSessionID == sessionID {
                    lessonRefreshError = "Couldn’t sync lesson documents. Pull down to retry."
                }
            }
        }
    }

    private func previousDocuments(_ previous: PreviousLessonResources, store: LessonStore) throws -> [PreviousLessonPDF] {
        let local = try store.lesson(sessionID: previous.sessionID).resources.map { PreviousLessonPDF.Source.local($0) }
        let synced = previous.workspace.map { PreviousLessonPDF.Source.synced($0) }
        let planned = previous.planned.map { PreviousLessonPDF.Source.catalog($0, planned: true) }
        let catalog = previous.catalog.map { PreviousLessonPDF.Source.catalog($0, planned: false) }
        var seen = Set<UUID>()
        return (local + synced + planned + catalog).map { PreviousLessonPDF(sessionID: previous.sessionID, source: $0) }
            .filter { $0.document.isPDF && $0.document.externalURL == nil && seen.insert($0.id).inserted }
    }

    func previousPDF(_ previous: PreviousLessonPDF, solutions: Bool = false) async throws -> Data {
        guard let document = solutions ? previous.solutions : previous.document else { throw CocoaError(.fileNoSuchFile) }
        let bytes: Data
        switch previous.source {
        case .local(let item):
            guard let store, let cached = solutions ? item.solutions : item.worksheet else { throw CocoaError(.fileNoSuchFile) }
            bytes = try Data(contentsOf: store.originalDocumentURL(sessionID: previous.sessionID, document: cached))
        case .synced(let synced):
            guard let id = solutions ? synced.solutionsArtifactID : synced.worksheetArtifactID else { throw CocoaError(.fileNoSuchFile) }
            bytes = try await api.downloadWorkspacePDF(id)
        case .catalog(_, let planned):
            bytes = try await api.download(document, sessionID: planned ? previous.sessionID : nil)
        }
        try validateOriginal(bytes)
        return bytes
    }

    func addPrevious(_ previous: PreviousLessonPDF, worksheet: Data) async -> Bool {
        guard !busy, !offline, let store, let sessionID = selectedSessionID else { return false }
        let version = epoch
        busy = true; defer { if version == epoch { busy = false } }
        do {
            let solutions = previous.solutions != nil ? try await previousPDF(previous, solutions: true) : nil
            guard epoch == version, selectedSessionID == sessionID else { return false }
            switch previous.source {
            case .local(let item):
                lesson = try store.addOriginal(item, to: sessionID, worksheet: worksheet, solutions: solutions, restoreArchived: true)
            case .synced(let synced):
                lesson = try store.addOriginal(synced.item, to: sessionID, worksheet: worksheet, solutions: solutions, restoreArchived: true)
            case .catalog(let resource, _):
                lesson = try store.add(resource, to: sessionID, worksheet: worksheet, solutions: solutions)
            }
            scheduleWorkspaceUpload(sessionID)
            return true
        } catch { report(error); return false }
    }

    private func validateOriginal(_ data: Data) throws {
        guard let pdf = PDFDocument(data: data), !pdf.isLocked, pdf.pageCount > 0 else {
            throw APIError(status: 0, message: "This lesson document is not a readable PDF.")
        }
    }

    private func importSessionPlan(_ sessionID: UUID, excluding resourceIDs: Set<UUID>) async {
        guard let store else { return }
        let version = epoch
        do {
            let plan: SessionLessonPlan = try await api.request("session-plan", query: [.init(name: "sessionID", value: sessionID.uuidString)])
            try Task.checkCancellation()
            guard version == epoch, selectedSessionID == sessionID else { return }
            let updated = try await store.importPlan(plan, excluding: resourceIDs) { source in
                let bytes = try await self.api.download(source, sessionID: sessionID)
                try Task.checkCancellation()
                guard version == self.epoch, self.selectedSessionID == sessionID else { throw CancellationError() }
                if source.isPDF, source.externalURL == nil, PDFDocument(data: bytes) == nil {
                    throw APIError(status: 0, message: "A planned resource is not a readable PDF.")
                }
                return bytes
            }
            guard version == epoch, selectedSessionID == sessionID else { return }
            lesson = updated
            if activeResourceID == nil { activeResourceID = updated.resources.first?.id }
        } catch {
            guard version == epoch, selectedSessionID == sessionID, !Task.isCancelled else { return }
            report(error)
        }
    }
    func showLessonInformation() {
        NotificationCenter.default.post(name: Notification.Name("TeachingPausePDF"), object: nil)
        guard let session, let profile else { ClassroomState.shared.clear(); return }
        ClassroomState.shared.showLesson(title: session.classroomTitle, time: "\(Self.time(session.startAt))–\(Self.time(session.endAt))", room: session.room ?? "", tutor: profile.name)
    }
    func leaveLesson() { planTask?.cancel(); planTask = nil; previousLesson = []; lessonRefreshError = nil; annotationCandidates = []; annotationsReady = false; printRequest = nil; route = []; selectedSessionID = nil; lesson = nil; activeResourceID = nil; viewer = false; ClassroomState.shared.clear() }
    func allowActiveWorksheet() {
        if viewer, let item = activeResource, item.worksheet.source.isPDF, item.worksheet.source.externalURL == nil {
            ClassroomState.shared.allowWorksheet(item.worksheet.id)
            NotificationCenter.default.post(name: Notification.Name("TeachingResumePDF"), object: item.worksheet.id)
        }
    }
    func open(_ item: LessonResource) {
        activeResourceID = item.id; viewer = true
        if !route.contains(.document) { route.append(.document) }
        showLessonInformation(); allowActiveWorksheet()
    }
    func showBoard() { route.removeAll { $0 == .document }; viewer = false; showLessonInformation() }
    func navigationChanged() {
        viewer = route.contains(.document); showLessonInformation(); allowActiveWorksheet()
    }
    func title(_ document: TeachingDocument) -> String {
        [document.code ?? resourceCodes[document.id], document.title].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
    }
    func refreshResourceCodes() async {
        guard !offline else { return }
        let ids = lesson?.resources.compactMap { item -> UUID? in
            guard let resource = item.resource, item.worksheet.source.code == nil,
                  resourceCodes[item.worksheet.source.id] == nil else { return nil }
            return resource.id
        } ?? []
        let version = epoch, sessionID = selectedSessionID
        for start in stride(from: 0, to: ids.count, by: 50) {
            do {
                let page: ResourcePage = try await api.request("resources", query: [.init(name: "resourceIDs", value: ids[start..<min(start + 50, ids.count)].map(\.uuidString).joined(separator: ","))])
                guard epoch == version, selectedSessionID == sessionID else { return }
                rememberCodes(page.resources)
            } catch {
                // Label backfill is optional; cached teaching remains available offline.
                if let failure = error as? APIError, failure.status == 401, epoch == version { report(error) }
                return
            }
        }
    }
    private func rememberCodes(_ resources: [TeachingResource]) {
        for resource in resources {
            resourceCodes[resource.worksheet.id] = resource.worksheet.code
            if let answer = resource.solutions { resourceCodes[answer.id] = answer.code }
        }
    }
    func search(_ text: String) async {
        guard let session else { return }
        let version = epoch, sessionID = session.id, subjectID = librarySubjectID, requestID = UUID()
        libraryRequest = requestID
        var offset = 0
        catalog = []
        libraryBusy = true; defer { if version == epoch, libraryRequest == requestID { libraryBusy = false } }
        do {
            while true {
                try Task.checkCancellation()
                var query = [URLQueryItem(name: "query", value: text), .init(name: "offset", value: String(offset))]
                if let subjectID { query.append(.init(name: "subjectID", value: subjectID.uuidString)) }
                let page: ResourcePage = try await api.request("resources", query: query)
                try Task.checkCancellation()
                guard version == epoch, selectedSessionID == sessionID, librarySubjectID == subjectID, libraryRequest == requestID else { return }
                librarySubjects = page.subjects; rememberCodes(page.resources)
                if !page.subjects.contains(where: { $0.id == librarySubjectID }) {
                    libraryTopics = []
                    librarySubjectID = page.subjects.first { $0.id == session.subjectID }?.id ?? page.subjects.first?.id
                    // Changing the selection starts a new guarded library task.
                    return
                }
                catalog.append(contentsOf: page.resources); libraryTopics = page.topics
                guard let next = page.nextOffset else { return }
                guard next > offset else { throw APIError(status: 503, message: "Could not finish loading the resource library. Please try again.") }
                offset = next
            }
        } catch { if !Task.isCancelled { report(error) } }
    }
    func add(_ resource: TeachingResource, freshCopy: Bool = false) async {
        guard let store, let session else { return }
        if !freshCopy, let existing = lesson?.resources.first(where: { $0.resource?.id == resource.id }) { open(existing); return }
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
            scheduleWorkspaceUpload(session.id)
            if activeResourceID == nil || freshCopy { activeResourceID = lesson?.resources.last?.id; allowActiveWorksheet() }
        } catch { report(error) }
    }
    func importDroppedPDFs(_ providers: [NSItemProvider]) -> Bool {
        let pdfs = providers.filter { $0.hasItemConformingToTypeIdentifier(UTType.pdf.identifier) }
        guard !pdfs.isEmpty, profile != nil, let sessionID = selectedSessionID else { return false }
        let version = epoch
        Task {
            for provider in pdfs {
                do {
                    let (data, title) = try await droppedPDF(provider)
                    guard version == epoch, selectedSessionID == sessionID else { return }
                    try importDocument(data, title: title)
                } catch { if version == epoch, selectedSessionID == sessionID { report(error) } }
            }
        }
        return true
    }
    private func droppedPDF(_ provider: NSItemProvider) async throws -> (Data, String) {
        let suggestedName = provider.suggestedName
        return try await withCheckedThrowingContinuation { continuation in
            provider.loadFileRepresentation(forTypeIdentifier: UTType.pdf.identifier) { url, error in
                do {
                    if let error { throw error }
                    guard let url else { throw APIError(status: 0, message: "This drop did not contain a readable PDF.") }
                    let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                    guard size <= 50 * 1024 * 1024 else { throw APIError(status: 0, message: "Choose a PDF smaller than 50 MB.") }
                    // Provider URLs expire when this callback returns; copy bytes before resuming.
                    let bytes = try Data(contentsOf: url)
                    continuation.resume(returning: (bytes, suggestedName ?? url.lastPathComponent))
                } catch { continuation.resume(throwing: error) }
            }
        }
    }
    func importDocuments(_ urls: [URL]) {
        for url in urls {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            do {
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size <= 50 * 1024 * 1024 else { throw APIError(status: 0, message: "Choose a PDF smaller than 50 MB.") }
                try importDocument(Data(contentsOf: url), title: url.lastPathComponent)
            } catch { report(error) }
        }
    }
    func importDocument(_ bytes: Data, title: String) throws {
        guard let store, let session else { throw APIError(status: 0, message: "Open a lesson before importing a PDF.") }
        guard !bytes.isEmpty, bytes.count <= 50 * 1024 * 1024,
              let pdf = PDFDocument(data: bytes), !pdf.isLocked, pdf.pageCount > 0 else {
            throw APIError(status: 0, message: "Choose a readable, unlocked PDF smaller than 50 MB.")
        }
        lesson = try store.addLocalDocument(title: title, to: session.id, pdf: bytes)
        scheduleWorkspaceUpload(session.id)
    }
    func addBlankDocument(landscape: Bool) {
        do {
            let size = landscape ? CGSize(width: 842, height: 595) : CGSize(width: 595, height: 842)
            let bytes = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { $0.beginPage() }
            try importDocument(bytes, title: landscape ? "Blank landscape.pdf" : "Blank portrait.pdf")
            if let added = lesson?.resources.last { open(added) }
        } catch { report(error) }
    }
    func remove(_ item: LessonResource) {
        guard let store, let session else { return }
        // Main-queue observers finish synchronously before changing document ownership.
        let save = PDFSaveRequest()
        NotificationCenter.default.post(name: Notification.Name("TeachingFlushPDF"), object: save)
        guard !save.failed else { return }
        do {
            let updated = try store.remove(item.id, from: session.id)
            NotificationCenter.default.post(name: Notification.Name("TeachingClosePDF"), object: [item.worksheet.id, item.solutions?.id].compactMap { $0 })
            lesson = updated
            if activeResourceID == item.id {
                activeResourceID = lesson?.resources.first?.id
                if viewer, let next = activeResource { open(next) } else { showBoard() }
            }
        } catch { report(error) }
    }
    func move(_ item: LessonResource, to targetID: UUID) {
        guard let store, let session, var items = lesson?.resources,
              let from = items.firstIndex(where: { $0.id == item.id }),
              let to = items.firstIndex(where: { $0.id == targetID }), from != to else { return }
        items.insert(items.remove(at: from), at: to)
        do { lesson = try store.reorder(items.map(\.id), in: session.id) } catch { report(error) }
    }
    func move(_ item: LessonResource, by delta: Int) {
        guard let items = lesson?.resources, let index = items.firstIndex(where: { $0.id == item.id }), items.indices.contains(index + delta) else { return }
        move(item, to: items[index + delta].id)
    }
    func loadSuggestions() async {
        guard let session else { return }
        let version = epoch, sessionID = session.id
        struct Input: Encodable { let sessionID: UUID; let resourceIDs: [UUID]; let activeResourceID: UUID? }
        struct Result: Decodable { let resources: [TeachingResource] }
        do {
            let input = Input(sessionID: sessionID, resourceIDs: lesson?.resources.compactMap { $0.resource?.id } ?? [], activeResourceID: activeResource?.resource?.id)
            let result: Result = try await api.request("suggestions", body: JSONEncoder().encode(input))
            try Task.checkCancellation()
            guard epoch == version, selectedSessionID == sessionID,
                  input.resourceIDs == (lesson?.resources.compactMap { $0.resource?.id } ?? []),
                  input.activeResourceID == activeResource?.resource?.id else { return }
            suggestions = result.resources
        } catch { if !Task.isCancelled { suggestions = [] } }
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
    func prepareAnnotations() {
        annotationCandidates = []; annotationsReady = false
        guard let session, let store, let tutor = profile, !session.logged else { return }
        let save = PDFSaveRequest()
        NotificationCenter.default.post(name: Notification.Name("TeachingFlushPDF"), object: save)
        guard !save.failed else { return }
        for item in lesson?.resources ?? [] where item.worksheet.source.isPDF && item.worksheet.source.externalURL == nil {
            do {
                guard try item.resource == nil || TeachingPDFSnapshots.hasLocalEdits(item.worksheet, sessionID: session.id, store: store) else { continue }
                let snapshot = try TeachingPDFSnapshots.prepare(item.worksheet, sessionID: session.id, store: store,
                    namespace: api.namespace, tutorID: tutor.id, annotations: true, blankPages: true)
                if snapshot.visiblePageCount > 0 { annotationCandidates.append(LessonAnnotationCandidate(item: item, snapshot: snapshot, failure: nil)) }
            } catch {
                annotationCandidates.append(LessonAnnotationCandidate(item: item, snapshot: nil, failure: error.localizedDescription))
            }
        }
        annotationsReady = true
    }
    func submitLog() async -> Bool {
        guard let session, let profile, let store, let draft = lesson?.draft, profile.canSubmitLogs, annotationsReady else { return false }
        guard session.students.allSatisfy({ draft.studentAttendance[$0.id] != nil }), session.staff.allSatisfy({ draft.staffAttendance[$0.id] != nil }),
              session.parents.allSatisfy({ draft.parentAttendance[$0.id] != nil }) else { error = "Confirm attendance for every participant."; return false }
        let version = epoch
        busy = true; defer { if version == epoch { busy = false } }
        do {
            // Persist the retry identity before any network work, including legacy lesson drafts.
            try store.saveDraft(draft, sessionID: session.id)
            let attending = session.students.filter { draft.studentAttendance[$0.id] == true }.map(\.id)
            struct Annotation: Encodable { let artifactID: UUID; let studentIds: [UUID] }
            var annotations: [Annotation] = []
            let selectedAnnotations = annotationCandidates.filter { !draft.excludedAnnotations.contains($0.id) }
            guard selectedAnnotations.count <= 50 else { throw APIError(status: 0, message: "Share up to 50 lesson PDFs per log. Turn off extra files before submitting.") }
            for candidate in selectedAnnotations {
                guard let snapshot = candidate.snapshot else { throw APIError(status: 0, message: "A shared PDF could not be prepared. Turn it off or reimport it before submitting.") }
                let artifactID = try await api.upload(snapshot, sessionID: session.id, document: candidate.item.worksheet,
                    purpose: "lesson", canonicalResourceID: candidate.item.resource?.id)
                guard epoch == version, selectedSessionID == session.id else { throw CancellationError() }
                let assigned = Set(draft.studentAssignments[candidate.id] ?? attending).intersection(attending)
                annotations.append(Annotation(artifactID: artifactID, studentIds: assigned.sorted { $0.uuidString < $1.uuidString }))
            }
            let suggestions = try store.logSuggestions(sessionID: session.id, attendingStudents: session.students.filter { draft.studentAttendance[$0.id] == true }.map(\.id))
            struct StaffAttendance: Encodable { let staffId: UUID; let attended: Bool; let type: String }
            struct StudentAttendance: Encodable { let studentId: UUID; let attended: Bool }
            struct ParentAttendance: Encodable { let parentId: UUID; let attended: Bool }
            struct Input: Encodable {
                let sessionId: UUID; let staffAttendance: [StaffAttendance]; let studentAttendance: [StudentAttendance]
                let parentAttendance: [ParentAttendance]; let topics: [TopicSelection]; let topicFiles: [FileSelection]; let notes: [String]
                let submissionID: UUID; let annotatedFiles: [Annotation]
            }
            let input = Input(sessionId: session.id,
                staffAttendance: session.staff.map { StaffAttendance(staffId: $0.id, attended: draft.staffAttendance[$0.id] == true, type: $0.type) },
                studentAttendance: session.students.map { StudentAttendance(studentId: $0.id, attended: draft.studentAttendance[$0.id] == true) },
                parentAttendance: session.parents.map { ParentAttendance(parentId: $0.id, attended: draft.parentAttendance[$0.id] == true) },
                topics: suggestions.topics, topicFiles: suggestions.topicFiles, notes: draft.notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? [] : [draft.notes],
                submissionID: draft.submissionID, annotatedFiles: annotations)
            struct Result: Decodable { let success: Bool }
            let result: Result = try await api.request("logs", body: JSONEncoder().encode(input))
            guard version == epoch else { return false }
            if result.success { await loadSessions(); return true }
            return false
        } catch { report(error); return false }
    }
    func presentPrint(_ document: CachedDocument) {
        guard let sessionID = selectedSessionID, let tutorID = profile?.id else { return }
        let save = PDFSaveRequest()
        NotificationCenter.default.post(name: Notification.Name("TeachingFlushPDF"), object: save)
        guard !save.failed else { return }
        showLessonInformation(); printRequest = TeachingPrintRequest(document: document, sessionID: sessionID, tutorID: tutorID)
    }
    func watchPrint(_ job: OfficePrintJob) {
        printNotice = "Queued for office printer: \(job.filename) · \(job.copies) \(job.copies == 1 ? "copy" : "copies")."
        let version = epoch
        printTasks[job.id] = Task { [weak self] in
            guard let self else { return }
            defer { printTasks[job.id] = nil }
            for _ in 0..<60 {
                do {
                    try await Task.sleep(for: .seconds(2))
                    let current: OfficePrintJob = try await api.request("prints/" + job.id.uuidString)
                    guard epoch == version else { return }
                    switch current.status {
                    case "queued", "claimed": continue
                    case "succeeded": printNotice = "Sent to office printer: \(current.filename) · \(current.copies) \(current.copies == 1 ? "copy" : "copies")."
                    case "ambiguous": printNotice = "Print may have started. Check the tray before retrying."
                    default: printNotice = current.error ?? "Couldn’t send to the office printer."
                    }
                    return
                } catch {
                    guard !Task.isCancelled, epoch == version else { return }
                    printNotice = "Print status unknown. Check the printer tray before retrying."; return
                }
            }
            if epoch == version { printNotice = "Print status unknown. Check the printer tray before retrying." }
        }
    }
    func finishSharing() {
        if let url = sharedURL, url.isFileURL, url.deletingLastPathComponent().deletingLastPathComponent() == AnnotatedPDF.exportsDirectory {
            try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
        }
        sharedURL = nil
    }
    func share(_ document: CachedDocument) {
        guard let store, let session else { return }
        let save = PDFSaveRequest()
        NotificationCenter.default.post(name: Notification.Name("TeachingFlushPDF"), object: save)
        guard !save.failed else { return }
        do { sharedURL = try AnnotatedPDF.export(document, sessionID: session.id, store: store) }
        catch { report(error) }
    }
}
