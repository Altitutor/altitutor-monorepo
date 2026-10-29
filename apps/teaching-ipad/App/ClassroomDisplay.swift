import SwiftUI
import PDFKit
import PencilKit

struct ClassroomLesson {
    let title: String; let time: String; let room: String; let tutor: String
}
struct ClassroomWorksheet {
    let id: UUID; let url: URL; let page: Int; let visibleRect: CGRect; let rotation: Int; let drawings: [Int: Data]
}

/// The audience model has no roster, notes, log draft or solutions field.
@MainActor final class ClassroomState: ObservableObject {
    static let shared = ClassroomState()
    @Published private(set) var lesson: ClassroomLesson?
    @Published private(set) var worksheet: ClassroomWorksheet?
    private var allowedWorksheet: UUID?
    func showLesson(title: String, time: String, room: String, tutor: String) {
        allowedWorksheet = nil; worksheet = nil; lesson = ClassroomLesson(title: title, time: time, room: room, tutor: tutor)
    }
    func allowWorksheet(_ id: UUID) { allowedWorksheet = id; worksheet = nil }
    func publishWorksheet(id: UUID, url: URL, page: Int, visibleRect: CGRect, rotation: Int, drawings: [Int: Data]) {
        guard allowedWorksheet == id else { return }
        worksheet = ClassroomWorksheet(id: id, url: url, page: page, visibleRect: visibleRect, rotation: rotation, drawings: drawings)
    }
    func clear() { allowedWorksheet = nil; worksheet = nil; lesson = nil }
}

struct ClassroomView: View {
    @ObservedObject var state = ClassroomState.shared
    var body: some View {
        Group {
            if let worksheet = state.worksheet { AudiencePDF(worksheet: worksheet) }
            else if let lesson = state.lesson {
                VStack(spacing: 25) {
                    Text("ALTITUTOR").font(.headline).tracking(5).foregroundStyle(.white.opacity(0.65))
                    Text(lesson.title).font(.system(size: 52, weight: .semibold)).multilineTextAlignment(.center)
                    Text(lesson.time).font(.title)
                    Text([lesson.room, lesson.tutor].filter { !$0.isEmpty }.joined(separator: " · ")).font(.title2).foregroundStyle(.white.opacity(0.8))
                }.padding(60).frame(maxWidth: .infinity, maxHeight: .infinity).background(TeachingColors.navy).foregroundStyle(.white)
            } else {
                Text("Altitutor").font(.system(size: 60, weight: .semibold)).frame(maxWidth: .infinity, maxHeight: .infinity).background(TeachingColors.navy).foregroundStyle(.white)
            }
        }.frame(maxWidth: .infinity, maxHeight: .infinity).ignoresSafeArea()
    }
}

struct AudiencePDF: UIViewRepresentable {
    let worksheet: ClassroomWorksheet
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> PDFView {
        let view = PDFView(); view.displayMode = .singlePage; view.isUserInteractionEnabled = false
        view.backgroundColor = .black; view.autoScales = false; view.minScaleFactor = 0.01; view.maxScaleFactor = 100
        view.pageOverlayViewProvider = context.coordinator
        return view
    }
    func updateUIView(_ view: PDFView, context: Context) {
        let c = context.coordinator
        if c.id != worksheet.id {
            c.id = worksheet.id; c.overlays.removeAll(); view.document = PDFDocument(url: worksheet.url)
            c.baseRotations = (0..<(view.document?.pageCount ?? 0)).map { view.document?.page(at: $0)?.rotation ?? 0 }
        }
        c.drawings = worksheet.drawings
        guard let pdf = view.document, let page = pdf.page(at: worksheet.page) else { return }
        for index in 0..<pdf.pageCount {
            let angle = (c.baseRotations[index] + worksheet.rotation) % 360
            if pdf.page(at: index)?.rotation != angle { pdf.page(at: index)?.rotation = angle }
        }
        for (index, overlay) in c.overlays {
            if let data = c.drawings[index], let drawing = try? PKDrawing(data: data) {
                overlay.image = drawing.image(from: CGRect(origin: .zero, size: overlay.bounds.size), scale: 2)
            } else { overlay.image = nil }
        }
        view.go(to: page)
        if !worksheet.visibleRect.isEmpty, !worksheet.visibleRect.isNull, view.bounds.width > 0, view.bounds.height > 0 {
            let rect = worksheet.visibleRect
            let quarterTurn = abs(page.rotation) % 180 == 90
            let size = quarterTurn ? CGSize(width: rect.height, height: rect.width) : rect.size
            let scale = min(view.bounds.width / size.width, view.bounds.height / size.height)
            if abs(view.scaleFactor - scale) > 0.001 { view.scaleFactor = scale }
            view.go(to: rect, on: page)
        }
    }
    @MainActor final class Coordinator: NSObject, @MainActor PDFPageOverlayViewProvider {
        var id: UUID?
        var baseRotations: [Int] = []
        var drawings: [Int: Data] = [:]
        var overlays: [Int: UIImageView] = [:]
        func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
            guard let pdf = view.document else { return nil }
            let index = pdf.index(for: page), bounds = CGRect(origin: .zero, size: page.bounds(for: .cropBox).size)
            let image = UIImageView(frame: bounds); image.isUserInteractionEnabled = false
            if let data = drawings[index], let drawing = try? PKDrawing(data: data) { image.image = drawing.image(from: bounds, scale: 2) }
            overlays[index] = image; return image
        }
    }
}

@MainActor final class ClassroomSceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.frame = windowScene.coordinateSpace.bounds
        window.rootViewController = UIHostingController(rootView: ClassroomView())
        window.isHidden = false; self.window = window
    }
}
