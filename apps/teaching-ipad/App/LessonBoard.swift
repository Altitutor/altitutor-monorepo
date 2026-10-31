import SwiftUI
import PDFKit
import TeachingCore
import UniformTypeIdentifiers

struct LessonBoard: View {
    @ObservedObject var model: TeachingModel
    @State private var dragging: UUID?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 210, maximum: 260), spacing: 20)], spacing: 20) {
                ForEach(model.lesson?.resources ?? []) { item in
                    Button { model.open(item) } label: {
                        VStack(alignment: .leading, spacing: 12) {
                            LessonThumbnail(model: model, item: item).frame(height: 180)
                            Text(item.resource.worksheet.title).font(.headline).lineLimit(2)
                                .frame(height: 44, alignment: .topLeading).frame(maxWidth: .infinity, alignment: .leading)
                        }.padding(16).background(.background, in: RoundedRectangle(cornerRadius: 20))
                    }.buttonStyle(.plain)
                        .contextMenu { LessonResourceActions(model: model, item: item) }
                        .onDrag {
                            dragging = item.id
                            let provider = NSItemProvider()
                            provider.registerDataRepresentation(forTypeIdentifier: LessonReorder.type.identifier, visibility: .ownProcess) { completion in
                                completion(Data(item.id.uuidString.utf8), nil); return nil
                            }
                            return provider
                        }
                        .onDrop(of: [LessonReorder.type], delegate: LessonReorder(model: model, target: item.id, animation: TeachingMotion.panel(reduceMotion: reduceMotion), dragging: $dragging))
                        .accessibilityAction(named: "Move before previous file") { model.move(item, by: -1) }
                        .accessibilityAction(named: "Move after next file") { model.move(item, by: 1) }
                }
            }.padding(28)
            if model.lesson?.resources.isEmpty != false {
                ContentUnavailableView("No lesson files", systemImage: "doc.badge.plus")
            }
        }.background(TeachingColors.background)
            .onDrop(of: [LessonReorder.type], delegate: LessonReorder(model: model, target: nil, animation: TeachingMotion.panel(reduceMotion: reduceMotion), dragging: $dragging))
            .onDisappear { dragging = nil }
    }
}

private struct LessonReorder: DropDelegate {
    static let type = UTType(exportedAs: "com.altitutor.lesson-resource")
    @ObservedObject var model: TeachingModel
    let target: UUID?
    let animation: Animation
    @Binding var dragging: UUID?
    func validateDrop(info: DropInfo) -> Bool { dragging != nil && info.hasItemsConforming(to: [Self.type]) }
    func dropEntered(info: DropInfo) {
        guard let target, let dragging, dragging != target, let item = model.lesson?.resources.first(where: { $0.id == dragging }) else { return }
        withAnimation(animation) { model.move(item, to: target) }
    }
    func dropUpdated(info: DropInfo) -> DropProposal? { DropProposal(operation: .move) }
    func performDrop(info: DropInfo) -> Bool { dragging = nil; return true }
}

struct LessonResourceActions: View {
    @ObservedObject var model: TeachingModel
    let item: LessonResource
    var body: some View {
        Button("Share worksheet", systemImage: "square.and.arrow.up") { model.share(item.worksheet) }
        if let solutions = item.solutions {
            Button("Share solutions", systemImage: "square.and.arrow.up") { model.share(solutions) }
        }
        Button("Download fresh copy", systemImage: "arrow.down.doc") { Task { await model.add(item.resource, freshCopy: true) } }.disabled(model.offline || model.busy)
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
            else { Image(systemName: item.resource.worksheet.externalURL == nil ? "doc" : "link").font(.largeTitle).foregroundStyle(.secondary) }
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 8))
            .task(id: item.worksheet.id) {
                guard let store = model.store, let session = model.session,
                      let url = try? store.documentURL(sessionID: session.id, document: item.worksheet) else { return }
                if item.resource.worksheet.isPDF {
                    image = PDFDocument(url: url)?.page(at: 0)?.thumbnail(of: CGSize(width: 440, height: 360), for: .cropBox)
                } else { image = UIImage(contentsOfFile: url.path) }
            }.accessibilityHidden(true)
    }
}
