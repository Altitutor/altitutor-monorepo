import SwiftUI
import PDFKit
import TeachingCore

struct ResourceDrawer: View {
    @ObservedObject var model: TeachingModel
    @Binding var isPresented: Bool
    let preview: (TeachingResource) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dragOffset = 0.0
    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .trailing) {
                Color.black.opacity(isPresented ? 0.12 : 0).contentShape(Rectangle())
                    .allowsHitTesting(isPresented).onTapGesture { dismiss() }
                    ResourceLibrary(model: model, isPresented: isPresented, preview: preview)
                        .frame(width: min(440, max(280, geometry.size.width - 40)))
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 26))
                        .clipShape(RoundedRectangle(cornerRadius: 26))
                        .shadow(color: .black.opacity(0.16), radius: 20, y: 6)
                        .padding(12)
                        .offset(x: reduceMotion ? dragOffset : (isPresented ? dragOffset : min(440, max(280, geometry.size.width - 40)) + 40))
                        .opacity(reduceMotion && !isPresented ? 0 : 1)
                        .accessibilityHidden(!isPresented)
                        .simultaneousGesture(DragGesture(minimumDistance: 20)
                            .onChanged { value in
                                if abs(value.translation.width) > abs(value.translation.height) {
                                    dragOffset = max(0, value.translation.width)
                                }
                            }.onEnded { value in
                                if dragOffset > 60 || (dragOffset > 0 && value.predictedEndTranslation.width > 140) { dismiss() }
                                else { withAnimation(TeachingMotion.panel(reduceMotion: reduceMotion)) { dragOffset = 0 } }
                            })
            }.animation(TeachingMotion.panel(reduceMotion: reduceMotion), value: isPresented)
                .clipped().allowsHitTesting(isPresented)
        }
    }
    private func dismiss() {
        withAnimation(TeachingMotion.panel(reduceMotion: reduceMotion)) { isPresented = false; dragOffset = 0 }
    }
}

struct ResourceLibrary: View {
    @ObservedObject var model: TeachingModel
    let isPresented: Bool
    let preview: (TeachingResource) -> Void
    @State private var query = ""
    @State private var allSubjects = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Resource library").font(.title3.bold())
            }.padding(20)
            Divider()
                VStack(alignment: .leading, spacing: 14) {
                    TextField("Search file names", text: $query).textFieldStyle(.roundedBorder).accessibilityIdentifier("resource-search")
                    if model.session?.subjectID != nil { Toggle("Search all subjects", isOn: $allSubjects).font(.subheadline) }
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            if !suggested.isEmpty {
                                Text("Suggested").font(.headline)
                                ForEach(suggested) { resource in
                                    LibraryFile(model: model, resource: resource, preview: preview)
                                }
                                Divider().padding(.vertical, 8)
                            }
                            ForEach(subjectIDs, id: \.self) { subject in
                                Text(model.libraryTopics.first { $0.subjectID == subject }?.subjectName ?? "Subject").font(.headline).padding(.top, 6)
                                ForEach(nodes(subject: subject, parent: nil, ancestors: [])) { node in
                                    TopicFolder(node: node, model: model, preview: preview, loadMore: { Task { await model.search(query, allSubjects: allSubjects, more: true) } })
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
        .task(id: String(isPresented) + suggestionKey) { if isPresented { await model.loadSuggestions() } }
        .task(id: String(isPresented) + query + String(allSubjects)) {
            guard isPresented else { return }
            do { try await Task.sleep(for: .milliseconds(250)); await model.search(query, allSubjects: allSubjects) } catch {}
        }
    }

    private var suggested: [TeachingResource] {
        model.suggestions.filter { candidate in model.lesson?.resources.contains { $0.resource.id == candidate.id } != true }
    }
    private var suggestionKey: String {
        (model.lesson?.resources.map { $0.resource.id.uuidString }.joined(separator: ",") ?? "") + (model.activeResourceID?.uuidString ?? "")
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
                    LibraryFile(model: model, resource: resource, preview: preview)
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

private struct LibraryFile: View {
    @ObservedObject var model: TeachingModel
    let resource: TeachingResource
    let preview: (TeachingResource) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button { preview(resource) } label: {
                Label(resource.worksheet.title, systemImage: "doc.richtext").font(.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
            }.buttonStyle(.plain).accessibilityHint("Preview without adding to this lesson")
            AddToLessonButton(model: model, resource: resource)
        }.padding(12).background(.background, in: RoundedRectangle(cornerRadius: 12))
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

struct LibraryPreview: View {
    @ObservedObject var model: TeachingModel
    let resource: TeachingResource
    let close: () -> Void
    @State private var pdf: PDFDocument?
    @State private var image: UIImage?
    @State private var loading = true
    @State private var failure: String?
    var body: some View {
        NavigationStack {
            Group {
                if let pdf { LibraryPDFPreview(document: pdf) }
                else if let image { Image(uiImage: image).resizable().scaledToFit() }
                else if let url = resource.worksheet.externalURL {
                    Link("Open external resource", destination: url).frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if loading { ProgressView("Loading preview…").frame(maxWidth: .infinity, maxHeight: .infinity) }
                else { ContentUnavailableView(failure ?? "Preview unavailable", systemImage: "doc") }
            }.frame(maxWidth: .infinity, maxHeight: .infinity).clipped()
            .navigationTitle(resource.worksheet.title).navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close", action: close) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add to lesson") {
                        Task {
                            await model.add(resource)
                            if model.lesson?.resources.contains(where: { $0.resource.id == resource.id }) == true { close() }
                        }
                    }.disabled(model.busy || model.offline || model.lesson?.resources.contains(where: { $0.resource.id == resource.id }) == true)
                }
            }
        }
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
