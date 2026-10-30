import SwiftUI
import PDFKit
import TeachingCore

struct ResourceLibrary: View {
    @ObservedObject var model: TeachingModel
    let dismiss: () -> Void
    @State private var query = ""
    @State private var allSubjects = false
    @State private var preview: TeachingResource?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Resource library").font(.title3.bold())
                Spacer()
                Button("Close", systemImage: "xmark", action: dismiss).labelStyle(.iconOnly)
            }.padding(20)
            Divider()
            if let preview {
                LibraryPreview(model: model, resource: preview) { self.preview = nil }.id(preview.id)
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    TextField("Search file names", text: $query).textFieldStyle(.roundedBorder).accessibilityIdentifier("resource-search")
                    if model.session?.subjectID != nil { Toggle("Search all subjects", isOn: $allSubjects).font(.subheadline) }
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            ForEach(subjectIDs, id: \.self) { subject in
                                Text(model.libraryTopics.first { $0.subjectID == subject }?.subjectName ?? "Subject").font(.headline).padding(.top, 6)
                                ForEach(nodes(subject: subject, parent: nil, ancestors: [])) { node in
                                    TopicFolder(node: node, model: model, preview: { preview = $0 }, loadMore: { Task { await model.search(query, allSubjects: allSubjects, more: true) } })
                                }
                            }
                            if model.libraryBusy { ProgressView().frame(maxWidth: .infinity) }
                            if model.libraryTopics.isEmpty && !model.libraryBusy { Text("No accessible topics.").foregroundStyle(.secondary) }
                            if model.nextOffset != nil {
                                Button("Load more files") { Task { await model.search(query, allSubjects: allSubjects, more: true) } }.disabled(model.libraryBusy)
                            }
                        }.padding(.bottom, 20)
                    }
                }.padding(20)
            }
        }
        .task(id: query + String(allSubjects)) {
            do { try await Task.sleep(for: .milliseconds(250)); await model.search(query, allSubjects: allSubjects) } catch {}
        }
    }

    private var subjectIDs: [UUID] {
        let topics = model.libraryTopics.sorted { $0.subjectName.localizedStandardCompare($1.subjectName) == .orderedAscending }
        var seen = Set<UUID>()
        return topics.compactMap { seen.insert($0.subjectID).inserted ? $0.subjectID : nil }
    }

    private func nodes(subject: UUID, parent: UUID?, ancestors: Set<UUID>) -> [LibraryTopicNode] {
        let topics = model.libraryTopics.filter { $0.subjectID == subject }
        let ids = Set(topics.map(\.id))
        return topics.filter { topic in
            !ancestors.contains(topic.id) && (parent == nil ? topic.parentID.map { !ids.contains($0) } ?? true : topic.parentID == parent)
        }.sorted { lhs, rhs in
            lhs.index == rhs.index ? lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending : lhs.index < rhs.index
        }.compactMap { topic in
            let children = nodes(subject: subject, parent: topic.id, ancestors: ancestors.union([topic.id]))
            let files = model.catalog.filter { $0.topicID == topic.id }.sorted { $0.worksheet.title.localizedStandardCompare($1.worksheet.title) == .orderedAscending }
            if !query.isEmpty && files.isEmpty && children.isEmpty { return nil }
            return LibraryTopicNode(id: topic.id, name: topic.name, children: children, resources: files)
        }
    }
}

private struct LibraryTopicNode: Identifiable {
    let id: UUID
    let name: String
    let children: [LibraryTopicNode]
    let resources: [TeachingResource]
}

private struct TopicFolder: View {
    let node: LibraryTopicNode
    @ObservedObject var model: TeachingModel
    let preview: (TeachingResource) -> Void
    let loadMore: () -> Void
    @State private var expanded = false
    var body: some View {
        DisclosureGroup(isExpanded: $expanded) {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(node.children) { child in
                    AnyView(TopicFolder(node: child, model: model, preview: preview, loadMore: loadMore))
                }
                ForEach(node.resources) { resource in
                    VStack(alignment: .leading, spacing: 8) {
                        Button { preview(resource) } label: {
                            Label(resource.worksheet.title, systemImage: "doc.richtext").font(.subheadline.weight(.medium))
                                .frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
                        }.buttonStyle(.plain).accessibilityHint("Preview without adding to this lesson")
                        AddToLessonButton(model: model, resource: resource)
                    }.padding(12).background(.background, in: RoundedRectangle(cornerRadius: 12))
                }
                if node.resources.isEmpty && node.children.isEmpty {
                    if model.nextOffset != nil {
                        Button("Load more files", action: loadMore).font(.subheadline).disabled(model.libraryBusy)
                    } else { Text("No files in this topic.").font(.caption).foregroundStyle(.secondary) }
                }
            }.padding(.leading, 10).padding(.vertical, 8)
        } label: {
            Label(node.name, systemImage: expanded ? "folder.fill" : "folder").font(.subheadline.weight(.semibold)).padding(.vertical, 7)
        }.tint(TeachingColors.navy)
    }
}

private struct AddToLessonButton: View {
    @ObservedObject var model: TeachingModel
    let resource: TeachingResource
    private var added: Bool { model.lesson?.resources.contains { $0.resource.id == resource.id } == true }
    var body: some View {
        Button(added ? "Added to lesson" : "Add to lesson", systemImage: added ? "checkmark" : "plus") {
            Task { await model.add(resource) }
        }.buttonStyle(.bordered).disabled(added || model.busy || model.offline)
    }
}

private struct LibraryPreview: View {
    @ObservedObject var model: TeachingModel
    let resource: TeachingResource
    let back: () -> Void
    @State private var pdf: PDFDocument?
    @State private var image: UIImage?
    @State private var loading = true
    @State private var failure: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Button("Topics", systemImage: "chevron.left", action: back)
            Text(resource.worksheet.title).font(.headline)
            Text(resource.topicName).font(.subheadline).foregroundStyle(.secondary)
            Group {
                if let pdf { LibraryPDFPreview(document: pdf) }
                else if let image { Image(uiImage: image).resizable().scaledToFit() }
                else if let url = resource.worksheet.externalURL {
                    Link("Open external resource", destination: url).frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if loading { ProgressView("Loading preview…").frame(maxWidth: .infinity, maxHeight: .infinity) }
                else { ContentUnavailableView(failure ?? "Preview unavailable", systemImage: "doc") }
            }.frame(maxWidth: .infinity, maxHeight: .infinity).clipped()
            AddToLessonButton(model: model, resource: resource)
            Text("Previewing does not add this file to the lesson.").font(.caption).foregroundStyle(.secondary)
        }.padding(20)
        .task {
            defer { loading = false }
            guard resource.worksheet.externalURL == nil else { return }
            do {
                let data = try await model.api.download(resource.worksheet)
                try Task.checkCancellation()
                if resource.worksheet.isPDF { pdf = PDFDocument(data: data) }
                else { image = UIImage(data: data) }
            } catch {
                if !Task.isCancelled { failure = error.localizedDescription }
            }
        }
    }
}

private struct LibraryPDFPreview: UIViewRepresentable {
    let document: PDFDocument
    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.document = document; view.autoScales = true
        view.displayMode = .singlePageContinuous; view.backgroundColor = .clear
        return view
    }
    func updateUIView(_ view: PDFView, context: Context) {}
}
