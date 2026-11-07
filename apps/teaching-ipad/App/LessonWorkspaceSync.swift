import SwiftUI
import PDFKit
import TeachingCore

struct SyncedLessonResource: Decodable {
    let item: LessonResource
    let worksheetArtifactID: UUID
    let solutionsArtifactID: UUID?
}

struct PreviousLessonPreview: View {
    @ObservedObject var model: TeachingModel
    let previous: PreviousLessonPDF
    @Environment(\.dismiss) private var dismiss
    @State private var bytes: Data?
    @State private var pdf: PDFDocument?
    @State private var failure: String?
    private var added: Bool { model.lesson?.resources.contains { $0.syncID == previous.id } == true }

    var body: some View {
        NavigationStack {
            Group {
                if let pdf { LibraryPDFPreview(document: pdf) }
                else if let failure {
                    ContentUnavailableView("Couldn’t open PDF", systemImage: "doc", description: Text(failure))
                } else { ProgressView("Loading PDF…") }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle(model.title(previous.document))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(added ? "Added to lesson" : "Add to lesson") {
                        guard let bytes else { return }
                        Task { if await model.addPrevious(previous, worksheet: bytes) { dismiss() } }
                    }.disabled(added || model.busy || model.offline || bytes == nil)
                }
            }
        }
        .task {
            do {
                let original = try await model.previousPDF(previous)
                try Task.checkCancellation()
                pdf = PDFDocument(data: original)
                bytes = original
            } catch {
                if !Task.isCancelled { failure = error.localizedDescription }
            }
        }
    }
}

struct PreviousLessonResources: Decodable {
    let sessionID: UUID
    let workspace: [SyncedLessonResource]
    let planned: [TeachingResource]
    let catalog: [TeachingResource]
}

struct PreviousLessonPDF: Identifiable {
    enum Source {
        case local(LessonResource)
        case synced(SyncedLessonResource)
        case catalog(TeachingResource, planned: Bool)
    }
    let sessionID: UUID
    let source: Source

    var id: UUID {
        switch source {
        case .local(let item): item.syncID
        case .synced(let synced): synced.item.syncID
        case .catalog(let resource, _): resource.id
        }
    }
    var document: TeachingDocument {
        switch source {
        case .local(let item): item.worksheet.source
        case .synced(let synced): synced.item.worksheet.source
        case .catalog(let resource, _): resource.worksheet
        }
    }
    var solutions: TeachingDocument? {
        switch source {
        case .local(let item): item.solutions?.source
        case .synced(let synced): synced.item.solutions?.source
        case .catalog(let resource, _): resource.solutions
        }
    }
}

@MainActor extension TeachingAPI {
    func syncOriginal(_ item: LessonResource, sessionID: UUID, store: LessonStore) async throws {
        struct Registration: Encodable {
            let sessionID: UUID
            let item: LessonResource
            let worksheetArtifactID: UUID
            let solutionsArtifactID: UUID?
        }
        struct Result: Decodable { let success: Bool }

        let original = try TeachingPDFSnapshots.original(item.worksheet, sessionID: sessionID, store: store)
        let worksheetID = try await upload(original, sessionID: sessionID, document: item.worksheet,
            purpose: "workspace", canonicalResourceID: nil)
        try Task.checkCancellation()
        let solutionsID: UUID?
        if let solutions = item.solutions {
            let original = try TeachingPDFSnapshots.original(solutions, sessionID: sessionID, store: store)
            solutionsID = try await upload(original, sessionID: sessionID, document: solutions,
                purpose: "workspace", canonicalResourceID: nil)
        } else { solutionsID = nil }
        try Task.checkCancellation()
        let input = Registration(sessionID: sessionID, item: item, worksheetArtifactID: worksheetID, solutionsArtifactID: solutionsID)
        let _: Result = try await request("workspace", body: JSONEncoder().encode(input))
    }
}
