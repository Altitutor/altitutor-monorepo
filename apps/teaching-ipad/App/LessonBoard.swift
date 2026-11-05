import SwiftUI
import PDFKit
import TeachingCore
import UniformTypeIdentifiers

struct LessonBoard: View {
    @ObservedObject var model: TeachingModel
    let addResource: () -> Void
    @State private var dragging: UUID?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let topics = model.lesson?.plannedTopics, !topics.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Planned topics").font(.headline)
                        ForEach(topics) { topic in Text([topic.code, topic.name].compactMap { $0 }.joined(separator: " · ")) }
                        Text("Preparation only. Confirm what you taught when logging.").font(.caption).foregroundStyle(.secondary)
                    }.padding(.horizontal, 28).padding(.top, 24)
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 210, maximum: 260), spacing: 20)], spacing: 20) {
                    ForEach(model.lesson?.resources ?? []) { item in
                        Button { model.open(item) } label: {
                            VStack(alignment: .leading, spacing: 12) {
                                LessonThumbnail(model: model, item: item).frame(height: 180)
                                Text(item.worksheet.source.title).font(.headline).lineLimit(2)
                                    .frame(height: 44, alignment: .topLeading).frame(maxWidth: .infinity, alignment: .leading)
                            }.padding(16).background(.background, in: RoundedRectangle(cornerRadius: 20))
                        }.buttonStyle(.plain)
                            .contextMenu { LessonResourceActions(model: model, item: item) }
                            .modifier(LessonResourceDrag(model: model, item: item, dragging: $dragging))
                    }
                    Menu {
                        Button("Blank landscape PDF", systemImage: "rectangle") { model.addBlankDocument(landscape: true) }
                        Button("Blank portrait PDF", systemImage: "rectangle.portrait") { model.addBlankDocument(landscape: false) }
                        Button("Add resource", systemImage: "books.vertical") { addResource() }
                    } label: {
                        Label("Add document", systemImage: "plus")
                            .font(.headline).frame(maxWidth: .infinity).frame(height: 236)
                            .background(.background, in: RoundedRectangle(cornerRadius: 20))
                            .overlay { RoundedRectangle(cornerRadius: 20).strokeBorder(.secondary.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [6])) }
                    }.buttonStyle(.plain).accessibilityIdentifier("teaching-add-document")
                }.padding(28)
            }
        }.background(TeachingColors.background)
            .onDrop(of: [LessonReorder.type, .pdf], delegate: LessonReorder(model: model, target: nil, animation: TeachingMotion.panel(reduceMotion: reduceMotion), dragging: $dragging))
            .onDisappear { dragging = nil }
    }
}

/// Board cards and document tabs use the same local move session and persisted order.
struct LessonResourceDrag: ViewModifier {
    @ObservedObject var model: TeachingModel
    let item: LessonResource
    @Binding var dragging: UUID?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content.onDrag {
            dragging = item.id
            let provider = NSItemProvider()
            provider.registerDataRepresentation(forTypeIdentifier: LessonReorder.type.identifier, visibility: .ownProcess) { completion in
                completion(Data(item.id.uuidString.utf8), nil)
                return nil
            }
            return provider
        }
        .onDrop(of: [LessonReorder.type], delegate: LessonReorder(model: model, target: item.id,
            animation: TeachingMotion.panel(reduceMotion: reduceMotion), dragging: $dragging))
        .accessibilityAction(named: "Move before previous file") { model.move(item, by: -1) }
        .accessibilityAction(named: "Move after next file") { model.move(item, by: 1) }
    }
}

struct LessonReorder: DropDelegate {
    static let type = UTType(exportedAs: "com.altitutor.lesson-resource")
    @ObservedObject var model: TeachingModel
    let target: UUID?
    let animation: Animation
    @Binding var dragging: UUID?
    func validateDrop(info: DropInfo) -> Bool {
        (dragging != nil && info.hasItemsConforming(to: [Self.type])) || (target == nil && info.hasItemsConforming(to: [.pdf]))
    }
    func dropEntered(info: DropInfo) {
        guard let target, let dragging, dragging != target, let item = model.lesson?.resources.first(where: { $0.id == dragging }) else { return }
        withAnimation(animation) { model.move(item, to: target) }
    }
    func dropUpdated(info: DropInfo) -> DropProposal? { DropProposal(operation: dragging == nil ? .copy : .move) }
    func performDrop(info: DropInfo) -> Bool {
        if dragging != nil { dragging = nil; return true }
        guard target == nil else { return false }
        return model.importDroppedPDFs(info.itemProviders(for: [.pdf]))
    }
}

struct LessonResourceActions: View {
    @ObservedObject var model: TeachingModel
    let item: LessonResource
    var body: some View {
        Button("Print to office", systemImage: "printer") { model.presentPrint(item.worksheet) }
            .disabled(model.offline || item.worksheet.source.externalURL != nil || !item.worksheet.source.isPDF)
        Button("Share worksheet", systemImage: "square.and.arrow.up") { model.share(item.worksheet) }
        if let solutions = item.solutions {
            Button("Share solutions", systemImage: "square.and.arrow.up") { model.share(solutions) }
        }
        if let resource = item.resource {
            Button("Download fresh copy", systemImage: "arrow.down.doc") { Task { await model.add(resource, freshCopy: true) } }.disabled(model.offline || model.busy)
        }
        Button("Move before previous file", systemImage: "arrow.left") { model.move(item, by: -1) }
            .disabled(model.lesson?.resources.first?.id == item.id)
        Button("Move after next file", systemImage: "arrow.right") { model.move(item, by: 1) }
            .disabled(model.lesson?.resources.last?.id == item.id)
        Divider()
        Button("Remove from lesson", systemImage: "trash", role: .destructive) { model.remove(item) }
    }
}

private struct LessonThumbnail: View {
    @ObservedObject var model: TeachingModel
    let item: LessonResource
    @State private var image: UIImage?
    var body: some View {
        Group {
            if let image { Image(uiImage: image).resizable().scaledToFit() }
            else { Image(systemName: item.worksheet.source.externalURL == nil ? "doc" : "link").font(.largeTitle).foregroundStyle(.secondary) }
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 8))
            .task(id: item.worksheet.id.uuidString + model.documentRevision.uuidString) {
                guard let store = model.store, let session = model.session,
                      let url = try? store.documentURL(sessionID: session.id, document: item.worksheet) else { return }
                if item.worksheet.source.isPDF {
                    image = PDFDocument(url: url)?.page(at: 0)?.thumbnail(of: CGSize(width: 440, height: 360), for: .cropBox)
                } else { image = UIImage(contentsOfFile: url.path) }
            }.accessibilityHidden(true)
    }
}
