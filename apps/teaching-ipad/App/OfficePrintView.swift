import SwiftUI
import TeachingCore

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

struct OfficePrintView: View {
    @ObservedObject var model: TeachingModel
    let document: TeachingDocument
    @Environment(\.dismiss) private var dismiss
    @State private var options: OfficePrintOptions?
    @State private var copies = 1
    @State private var submitting = false
    @State private var failure: String?
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(model.title(document)).font(.headline)
                    Text("Sends the original resource to the FUJ office printer.").foregroundStyle(.secondary)
                    Stepper("Copies: \(copies)", value: $copies, in: 1...20)
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
                            .disabled(submitting || model.offline || options?.online != true || options?.allowed != true)
                    }
                }
        }.interactiveDismissDisabled(submitting)
            .task {
                do { options = try await model.api.request("print-options") }
                catch { if !Task.isCancelled { failure = error.localizedDescription; model.report(error) } }
            }
    }
    private func submit() async {
        struct Input: Encodable { let resourceID: UUID; let copies: Int }
        submitting = true; defer { submitting = false }
        do {
            let job: OfficePrintJob = try await model.api.request("prints", body: JSONEncoder().encode(Input(resourceID: document.id, copies: copies)))
            model.watchPrint(job); dismiss()
        } catch { failure = error.localizedDescription; model.report(error) }
    }
}
