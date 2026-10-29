import SwiftUI
import TeachingCore

struct TutorLogView: View {
    @ObservedObject var model: TeachingModel
    let initialSession: TeachingSession
    var session: TeachingSession { model.session ?? initialSession }
    init(model: TeachingModel, session: TeachingSession) { self.model = model; self.initialSession = session }
    @Environment(\.dismiss) private var dismiss
    @State private var confirm = false
    @State private var addStudent = false
    private var draft: LessonDraft { model.lesson?.draft ?? LessonDraft() }
    private var maySubmit: Bool {
        guard model.profile?.canSubmitLogs == true, session.startAt <= Date(), !model.offline else { return false }
        if session.kind == "CHECK_IN" {
            let type = session.staff.first { $0.id == model.profile?.id }?.type ?? ""
            return ["CHECK_IN_HOST", "SECONDARY_TUTOR", "TRIAL_TUTOR"].contains(type)
        }
        return true
    }
    private func update(_ change: (inout LessonDraft) -> Void) { var next = draft; change(&next); model.saveDraft(next) }
    var body: some View {
        NavigationStack {
            Group {
            if session.logged { SavedTutorLogView(model: model, sessionID: session.id) }
            else {
                Form {
                    Section {
                        Text(session.title).font(.headline)
                        Text("Confirm attendance and who used each resource. Added files and topics are suggestions until you submit.").foregroundStyle(.secondary)
                        if let error = model.error { Text(error).foregroundStyle(.red) }
                    }
                    if !session.staff.isEmpty {
                        Section("Staff attendance") {
                            ForEach(session.staff) { person in
                                AttendanceRow(name: person.name, attended: draft.staffAttendance[person.id]) { value in update { $0.staffAttendance[person.id] = value } }
                            }
                        }
                    }
                    if !session.students.isEmpty {
                        Section("Student attendance") {
                            ForEach(session.students) { person in
                                AttendanceRow(name: person.name, attended: draft.studentAttendance[person.id]) { value in update { $0.studentAttendance[person.id] = value } }
                            }
                        }
                    }
                    if session.kind == "HOMEWORK_HELP", model.profile?.canSubmitLogs == true {
                        Section { Button("Add a drop-in student") { addStudent = true }.disabled(model.offline || model.busy) }
                    }
                    if !session.parents.isEmpty {
                        Section("Parent attendance") {
                            ForEach(session.parents) { person in
                                AttendanceRow(name: person.name, attended: draft.parentAttendance[person.id]) { value in update { $0.parentAttendance[person.id] = value } }
                            }
                        }
                    }
                    Section("Lesson resources and topics") {
                        if model.lesson?.resources.isEmpty != false { Text("No resource suggestions. You can log attendance and notes without choosing a topic.").foregroundStyle(.secondary) }
                        ForEach(model.lesson?.resources ?? []) { item in
                            VStack(alignment: .leading, spacing: 14) {
                                Toggle(isOn: Binding(get: { !draft.excludedResources.contains(item.id) }, set: { included in
                                    update { if included { $0.excludedResources.remove(item.id) } else { $0.excludedResources.insert(item.id) } }
                                })) { VStack(alignment: .leading) { Text(item.resource.worksheet.title); Text(item.resource.topicName).font(.caption).foregroundStyle(.secondary) } }
                                if !draft.excludedResources.contains(item.id) {
                                    let attending = session.students.filter { draft.studentAttendance[$0.id] == true }
                                    if attending.isEmpty { Text("Select attending students above to assign this resource.").font(.caption).foregroundStyle(.secondary) }
                                    ForEach(attending) { person in
                                        let assigned = draft.studentAssignments[item.id] ?? attending.map(\.id)
                                        Toggle(person.name, isOn: Binding(get: { assigned.contains(person.id) }, set: { include in
                                            update { value in
                                                var ids = value.studentAssignments[item.id] ?? attending.map(\.id)
                                                if include { if !ids.contains(person.id) { ids.append(person.id) } } else { ids.removeAll { $0 == person.id } }
                                                value.studentAssignments[item.id] = ids
                                            }
                                        })).font(.subheadline)
                                    }
                                }
                            }.padding(.vertical, 7)
                        }
                    }
                    Section("Session notes") {
                        TextEditor(text: Binding(get: { draft.notes }, set: { text in update { $0.notes = text } })).frame(minHeight: 130)
                    }
                    Section {
                        Button("Submit tutor log") { confirm = true }.disabled(!maySubmit || model.busy).accessibilityIdentifier("teaching-submit-log")
                        if !maySubmit { Text("Submission needs a connection, an active staff account and a started session. Check-ins can be logged by conducting staff.").font(.caption).foregroundStyle(.secondary) }
                        Text("Annotations remain on this iPad. Submitting a log does not upload or share your marked-up PDFs.").font(.caption).foregroundStyle(.secondary)
                    }
                }.confirmationDialog("Submit the confirmed lesson log?", isPresented: $confirm) {
                    Button("Submit log") { Task { if await model.submitLog() { dismiss() } } }
                } message: { Text("After submission, corrections follow the existing administrator workflow.") }
            }
            }
            .sheet(isPresented: $addStudent) { DropInStudentView(model: model, sessionID: session.id) }
        .navigationTitle(session.logged ? "Tutor log" : "Review lesson log")
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
        }
    }
}

struct AttendanceRow: View {
    let name: String
    let attended: Bool?
    let select: (Bool) -> Void
    var body: some View {
        HStack {
            Text(name); Spacer()
            Button("Present") { select(true) }.tint(attended == true ? TeachingColors.teal : .gray).buttonStyle(.borderedProminent)
            Button("Absent") { select(false) }.tint(attended == false ? TeachingColors.navy : .gray).buttonStyle(.borderedProminent)
        }.accessibilityElement(children: .contain)
    }
}

struct SavedTutorLog: Decodable {
    struct Note: Decodable, Identifiable { let id: UUID; let note: String }
    struct Topic: Decodable, Identifiable { let id: UUID; let topic_name: String }
    struct File: Decodable, Identifiable { let id: UUID; let filename: String }
    let created_by_first_name: String?
    let created_by_last_name: String?
    let tutor_log_created_at: Date?
    let notes: [Note]?
    let topics: [Topic]?
    let files: [File]?
}

struct SavedTutorLogView: View {
    @ObservedObject var model: TeachingModel
    let sessionID: UUID
    @State private var record: SavedTutorLog?
    @State private var failure: String?
    var body: some View {
        List {
            if let record {
                Section("Submitted tutor log") {
                    Text([record.created_by_first_name, record.created_by_last_name].compactMap { $0 }.joined(separator: " "))
                    if let date = record.tutor_log_created_at { Text(date, style: .date) }
                }
                Section("Topics") { ForEach(record.topics ?? []) { Text($0.topic_name) } }
                Section("Resources") { ForEach(record.files ?? []) { Text($0.filename) } }
                Section("Notes") { ForEach(record.notes ?? []) { Text($0.note) } }
                Section { Text("This log is read-only. Ask an administrator for corrections.").font(.footnote).foregroundStyle(.secondary) }
            } else if let failure { Text(failure).foregroundStyle(.red) }
            else { ProgressView("Loading log…") }
        }.task {
            do { record = try await model.api.request("logs/" + sessionID.uuidString) }
            catch { failure = error.localizedDescription }
        }
    }
}

struct DropInStudentView: View {
    @ObservedObject var model: TeachingModel
    let sessionID: UUID
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var students: [Participant] = []
    @State private var failure: String?
    var body: some View {
        NavigationStack {
            List {
                TextField("Search student name", text: $query).autocorrectionDisabled()
                if let failure { Text(failure).foregroundStyle(.red) }
                if query.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 { Text("Enter at least two letters.").foregroundStyle(.secondary) }
                ForEach(students.filter { candidate in !(model.session?.students.contains { $0.id == candidate.id } ?? false) }) { student in
                    Button(student.name) { Task { await model.addStudent(student); if model.session?.students.contains(where: { $0.id == student.id }) == true { dismiss() } } }.disabled(model.busy)
                }
            }.navigationTitle("Add drop-in student")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
            .task(id: query) {
                students = []; failure = nil
                guard query.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 else { return }
                do {
                    try await Task.sleep(for: .milliseconds(300))
                    let found: [Participant] = try await model.api.request("students", query: [.init(name: "sessionID", value: sessionID.uuidString), .init(name: "query", value: query)])
                    try Task.checkCancellation(); students = found
                } catch { if !Task.isCancelled { failure = error.localizedDescription } }
            }
        }
    }
}
