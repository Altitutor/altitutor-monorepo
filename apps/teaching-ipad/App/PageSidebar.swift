import SwiftUI
import PDFKit
import TeachingCore

@MainActor final class PDFPageNavigation: ObservableObject {
    @Published var page = 0
    @Published var count = 0
    @Published var thumbnailVersion = 0
    @Published var indicatorVisible = false
    weak var editor: PDFDocumentSurface.Coordinator?
    private var indicatorTask: Task<Void, Never>?

    func activity(page: Int, count: Int) {
        if self.page != page { self.page = page }
        if self.count != count { self.count = count }
        indicatorVisible = true
        indicatorTask?.cancel()
        indicatorTask = Task { [weak self] in
            do { try await Task.sleep(for: .seconds(2)) } catch { return }
            self?.indicatorVisible = false
        }
    }
    func stop() { indicatorTask?.cancel(); indicatorTask = nil; editor = nil }
}

struct PDFEditorView: View {
    let document: CachedDocument
    let sessionID: UUID
    let store: LessonStore
    let isWorksheet: Bool
    let fingerDrawing: Bool
    @Binding var sidebar: Bool
    let onEdit: () -> Void
    let onError: (Error) -> Void
    @StateObject private var navigation = PDFPageNavigation()
    @State private var reveal: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geometry in
            let width = min(170.0, max(104.0, geometry.size.width * 0.18))
            HStack(spacing: 0) {
                PageThumbnails(navigation: navigation)
                    .frame(width: width)
                    .frame(width: sidebar ? max(0, width + reveal) : reveal, alignment: .leading).clipped()
                    .accessibilityHidden(!sidebar)
                    .simultaneousGesture(DragGesture(minimumDistance: 20)
                        .onChanged { value in
                            if sidebar, abs(value.translation.width) > abs(value.translation.height) { reveal = min(0, value.translation.width) }
                        }.onEnded { value in
                            withAnimation(TeachingMotion.panel(reduceMotion: reduceMotion)) {
                                if reveal < -40 || value.predictedEndTranslation.width < -100 { sidebar = false }
                                reveal = 0
                            }
                        })
                PDFDocumentSurface(document: document, sessionID: sessionID, store: store, isWorksheet: isWorksheet,
                    fingerDrawing: fingerDrawing, navigation: navigation, onEdit: onEdit, onError: onError)
                    .overlay(alignment: .topLeading) {
                        if navigation.count > 0 {
                            Button { withAnimation(TeachingMotion.panel(reduceMotion: reduceMotion)) { sidebar.toggle() }; navigation.activity(page: navigation.page, count: navigation.count) } label: {
                                Label("\(navigation.page + 1) of \(navigation.count)", systemImage: "sidebar.left")
                                    .font(.subheadline.weight(.medium)).monospacedDigit().padding(.horizontal, 12).padding(.vertical, 9)
                            }.buttonStyle(.glass).padding(16)
                                .opacity(navigation.indicatorVisible ? 1 : 0)
                                .allowsHitTesting(navigation.indicatorVisible).accessibilityHidden(!navigation.indicatorVisible)
                                .accessibilityLabel("Toggle page sidebar, page \(navigation.page + 1) of \(navigation.count)")
                                .accessibilityIdentifier(isWorksheet ? "worksheet-page-indicator" : "solutions-page-indicator")
                                .animation(.easeOut(duration: 0.15), value: navigation.indicatorVisible)
                        }
                    }
            }
            .overlay(alignment: .leading) {
                if isWorksheet, !sidebar {
                    EdgeSwipeRegion(edge: .left, changed: { reveal = min(width, max(0, $0)) }, ended: { distance, velocity in
                        withAnimation(TeachingMotion.panel(reduceMotion: reduceMotion)) {
                            sidebar = distance > 40 || velocity > 250; reveal = 0
                        }
                    }).frame(width: 24)
                }
            }
            .animation(TeachingMotion.panel(reduceMotion: reduceMotion), value: sidebar)
            .onChange(of: sidebar) { _, _ in navigation.activity(page: navigation.page, count: navigation.count) }
        }
    }
}

private struct PageThumbnails: View {
    @ObservedObject var navigation: PDFPageNavigation
    var body: some View {
        ScrollViewReader { scroll in
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(0..<navigation.count, id: \.self) { index in
                        PageThumbnail(navigation: navigation, index: index).id(index)
                    }
                }.padding(12)
            }.background(.regularMaterial)
                .onChange(of: navigation.page) { _, page in scroll.scrollTo(page, anchor: .center) }
                .onAppear { scroll.scrollTo(navigation.page, anchor: .center) }
        }
    }
}

private struct PageThumbnail: View {
    @ObservedObject var navigation: PDFPageNavigation
    let index: Int
    @State private var image: UIImage?
    var body: some View {
        VStack(spacing: 6) {
            Button { navigation.editor?.jump(to: index) } label: {
                Group {
                    if let image { Image(uiImage: image).resizable().scaledToFit() }
                    else { Rectangle().fill(.background).aspectRatio(0.707, contentMode: .fit).overlay { ProgressView() } }
                }.frame(maxWidth: .infinity).background(.white, in: RoundedRectangle(cornerRadius: 6))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay { RoundedRectangle(cornerRadius: 6).strokeBorder(navigation.page == index ? TeachingColors.teal : .clear, lineWidth: 3) }
            }.buttonStyle(.plain).accessibilityLabel("Page \(index + 1)")
                .accessibilityAddTraits(navigation.page == index ? .isSelected : [])
            HStack {
                Text("\(index + 1)").font(.caption).monospacedDigit().foregroundStyle(.secondary)
                Spacer()
                Menu {
                    Button("Insert blank page before", systemImage: "document.badge.plus") { navigation.editor?.editPages(.insertBlank(at: index), matching: index) }
                    Button("Insert blank page after", systemImage: "document.badge.plus") { navigation.editor?.editPages(.insertBlank(at: index + 1), matching: index) }
                    Divider()
                    Button("Delete page", systemImage: "trash", role: .destructive) { navigation.editor?.editPages(.delete(at: index)) }.disabled(navigation.count <= 1)
                } label: { Image(systemName: "ellipsis").frame(width: 32, height: 28).contentShape(Rectangle()) }
                    .accessibilityLabel("Actions for page \(index + 1)")
            }
        }.task(id: navigation.thumbnailVersion) { image = navigation.editor?.thumbnail(at: index) }
    }
}

/// An actual edge recognizer keeps PDF panning/inking and vertical list scrolling separate.
struct EdgeSwipeRegion: UIViewRepresentable {
    let edge: UIRectEdge
    let changed: (CGFloat) -> Void
    let ended: (CGFloat, CGFloat) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> EdgeView {
        let view = EdgeView()
        let recognizer = UIScreenEdgePanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.pan(_:)))
        recognizer.edges = edge; recognizer.delegate = context.coordinator
        view.addGestureRecognizer(recognizer); view.edgeGesture = recognizer
        return view
    }
    func updateUIView(_ view: EdgeView, context: Context) { context.coordinator.parent = self }
    @MainActor final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var parent: EdgeSwipeRegion
        init(_ parent: EdgeSwipeRegion) { self.parent = parent }
        func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            guard let pan = gestureRecognizer as? UIPanGestureRecognizer else { return false }
            let velocity = pan.velocity(in: pan.view)
            return abs(velocity.x) > abs(velocity.y) && (parent.edge == .left ? velocity.x > 0 : velocity.x < 0)
        }
        @objc func pan(_ gesture: UIScreenEdgePanGestureRecognizer) {
            let distance = gesture.translation(in: gesture.view).x
            switch gesture.state {
            case .began, .changed: parent.changed(distance)
            case .ended: parent.ended(distance, gesture.velocity(in: gesture.view).x)
            case .cancelled, .failed: parent.ended(0, 0)
            default: break
            }
        }
    }
    @MainActor final class EdgeView: UIView {
        weak var edgeGesture: UIScreenEdgePanGestureRecognizer?
        override func didMoveToWindow() {
            super.didMoveToWindow()
            guard window != nil, let edgeGesture, edgeGesture.edges == .left else { return }
            // In the PDF layer the left edge opens pages; the native Back button remains available.
            var responder: UIResponder? = self
            while let current = responder {
                if let controller = current as? UIViewController, let back = controller.navigationController?.interactivePopGestureRecognizer {
                    back.require(toFail: edgeGesture); break
                }
                responder = current.next
            }
        }
    }
}
