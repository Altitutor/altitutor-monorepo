import SwiftUI
import TeachingCore
import PDFKit

struct OfficePrintOptions: Decodable {
    let online: Bool
    let windowOpen: Bool
    let access: String
    let allowed: Bool
}
struct OfficePrintJob: Decodable, Identifiable {
    let id: UUID
    let status: String
    let filename: String
    let copies: Int
    let error: String?
}

struct TeachingPrintRequest: Identifiable {
    let document: CachedDocument
    let sessionID: UUID
    let tutorID: UUID
    var id: UUID { document.id }
}

struct OfficePrintView: View {
    @ObservedObject var model: TeachingModel
    let request: TeachingPrintRequest
    private var document: CachedDocument { request.document }
    @Environment(\.dismiss) private var dismiss
    @State private var options: OfficePrintOptions?
    @State private var copies = 1
    @State private var submitting = false
    @State private var includeAnnotations = false
    @State private var includeBlankPages = false
    @State private var snapshot: TeachingPDFSnapshot?
    @State private var preparationFailure: String?
    @State private var failure: String?
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(model.title(document.source)).font(.headline)
                    Toggle("Include annotations", isOn: $includeAnnotations).accessibilityIdentifier("print-annotations")
                    Toggle("Include blank pages", isOn: $includeBlankPages).accessibilityIdentifier("print-blank-pages")
                    Stepper("Copies: \(copies)", value: $copies, in: 1...20)
                }.disabled(submitting)
                Section("Preview") {
                    if let snapshot {
                        PrintPDFPreview(url: snapshot.url).id(snapshot.sha256).frame(height: 460)
                        Text("\(snapshot.pageCount) \(snapshot.pageCount == 1 ? "page" : "pages") per copy").font(.caption).foregroundStyle(.secondary)
                    } else if let preparationFailure {
                        Text(preparationFailure).foregroundStyle(.secondary)
                    } else { ProgressView("Preparing preview…") }
                }
                Section {
                    Text("Black & white · A4 · double-sided (long edge) · one staple top-left")
                }
                Section {
                    if let options {
                        if !options.online { Label("Office printer offline", systemImage: "printer.filled.and.paper").foregroundStyle(.red) }
                        if !options.allowed { Text(options.access == "off" ? "Office print is turned off for tutors." : "Available only during an admin shift.").foregroundStyle(.red) }
                    } else if failure == nil { ProgressView("Checking office printer…") }
                    if let failure { Text(failure).foregroundStyle(.red) }
                }
            }.navigationTitle("Print to office").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(submitting) }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(submitting ? "Sending…" : "Print to office") { Task { await submit() } }
                            .disabled(submitting || model.offline || options?.online != true || options?.allowed != true || snapshot == nil)
                    }
                }
        }.interactiveDismissDisabled(submitting)
            .task(id: "\(includeAnnotations):\(includeBlankPages):\(document.id)") { prepare() }
            .task {
                do { options = try await model.api.request("print-options") }
                catch { if !Task.isCancelled { failure = error.localizedDescription; model.report(error) } }
            }
    }
    private func prepare() {
        snapshot = nil; preparationFailure = nil
        guard let store = model.store, model.selectedSessionID == request.sessionID, model.profile?.id == request.tutorID else { return }
        do {
            snapshot = try TeachingPDFSnapshots.prepare(document, sessionID: request.sessionID, store: store,
                namespace: model.api.namespace, tutorID: request.tutorID, annotations: includeAnnotations, blankPages: includeBlankPages)
        } catch { preparationFailure = error.localizedDescription }
    }
    private func submit() async {
        guard let snapshot, model.selectedSessionID == request.sessionID, model.profile?.id == request.tutorID else { return }
        let sessionID = request.sessionID, tutorID = request.tutorID
        struct Input: Encodable { let artifactID: UUID; let copies: Int }
        submitting = true; defer { submitting = false }
        do {
            let artifactID = try await model.api.upload(snapshot, sessionID: sessionID, document: document, purpose: "print", canonicalResourceID: nil)
            guard model.selectedSessionID == sessionID, model.profile?.id == tutorID else { throw CancellationError() }
            let job: OfficePrintJob = try await model.api.request("prints", body: JSONEncoder().encode(Input(artifactID: artifactID, copies: copies)))
            guard model.selectedSessionID == sessionID, model.profile?.id == tutorID else { return }
            model.watchPrint(job); dismiss()
        } catch { if !(error is CancellationError) { failure = error.localizedDescription } }
    }
}

private struct PrintPDFPreview: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.document = PDFDocument(url: url); view.autoScales = true
        view.displayMode = .singlePageContinuous; view.backgroundColor = .clear
        return view
    }
    func updateUIView(_ view: PDFView, context: Context) {}
}
