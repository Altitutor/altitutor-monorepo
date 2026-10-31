import SwiftUI
import PDFKit
import TeachingCore

struct LessonBoard: View {
    @ObservedObject var model: TeachingModel
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
                        .draggable(item.id.uuidString)
                        .dropDestination(for: String.self) { values, _ in
                            guard let id = values.first.flatMap(UUID.init(uuidString:)),
                                  let source = model.lesson?.resources.first(where: { $0.id == id }) else { return false }
                            withAnimation { model.move(source, to: item.id) }; return true
                        }
                }
            }.padding(28)
            if model.lesson?.resources.isEmpty != false {
                ContentUnavailableView("No lesson files", systemImage: "doc.badge.plus")
            }
        }.background(TeachingColors.background)
    }
}

struct LessonResourceActions: View {
    @ObservedObject var model: TeachingModel
    let item: LessonResource
    private var index: Int { model.lesson?.resources.firstIndex(where: { $0.id == item.id }) ?? 0 }
    var body: some View {
        Button("Share worksheet", systemImage: "square.and.arrow.up") { model.share(item.worksheet) }
        if let solutions = item.solutions {
            Button("Share solutions", systemImage: "square.and.arrow.up") { model.share(solutions) }
        }
        Button("Download fresh copy", systemImage: "arrow.down.doc") { Task { await model.add(item.resource, freshCopy: true) } }.disabled(model.offline || model.busy)
        Divider()
        Button("Move earlier", systemImage: "arrow.left") { withAnimation { model.move(item, by: -1) } }.disabled(index == 0)
        Button("Move later", systemImage: "arrow.right") { withAnimation { model.move(item, by: 1) } }.disabled(index + 1 >= (model.lesson?.resources.count ?? 0))
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
