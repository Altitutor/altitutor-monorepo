import SwiftUI
import PDFKit
import PencilKit

struct ClassroomLesson {
    let title: String; let time: String; let room: String; let tutor: String
}
struct ClassroomWorksheet: Equatable {
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
        let next = ClassroomWorksheet(id: id, url: url, page: page, visibleRect: visibleRect, rotation: rotation, drawings: drawings)
        if next != worksheet { worksheet = next }
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
    func makeUIView(context: Context) -> ClassroomPDFCanvas { ClassroomPDFCanvas() }
    func updateUIView(_ view: ClassroomPDFCanvas, context: Context) { view.show(worksheet) }
}

/// A read-only projection of the worksheet's exact page-space region. No PDF navigation or private pane exists here.
@MainActor final class ClassroomPDFCanvas: UIView {
    private var worksheet: ClassroomWorksheet?
    private var pdf: PDFDocument?
    func show(_ next: ClassroomWorksheet) {
        if worksheet?.id != next.id || worksheet?.url != next.url { pdf = PDFDocument(url: next.url) }
        guard worksheet != next else { return }
        worksheet = next; isOpaque = true; backgroundColor = .black; isUserInteractionEnabled = false
        contentMode = .redraw; setNeedsDisplay()
    }
    override func draw(_ rect: CGRect) {
        guard let graphics = UIGraphicsGetCurrentContext() else { return }
        UIColor.black.setFill(); graphics.fill(bounds)
        guard let worksheet, let page = pdf?.page(at: worksheet.page), let reference = page.pageRef else { return }
        let crop = reference.getBoxRect(.cropBox)
        let quarterTurn = abs(Int(reference.rotationAngle) + worksheet.rotation) % 180 == 90
        let size = quarterTurn ? CGSize(width: crop.height, height: crop.width) : crop.size
        let pageTransform = reference.getDrawingTransform(.cropBox, rect: CGRect(origin: .zero, size: size),
                                                     rotate: Int32(worksheet.rotation), preserveAspectRatio: true)
        let visible = worksheet.visibleRect.isEmpty || worksheet.visibleRect.isNull ? crop : worksheet.visibleRect
        let displayRegion = visible.applying(pageTransform)
        guard displayRegion.width > 0, displayRegion.height > 0 else { return }
        let scale = min(bounds.width / displayRegion.width, bounds.height / displayRegion.height)
        let target = CGRect(x: (bounds.width - displayRegion.width * scale) / 2,
                            y: (bounds.height - displayRegion.height * scale) / 2,
                            width: displayRegion.width * scale, height: displayRegion.height * scale)
        graphics.saveGState()
        graphics.translateBy(x: 0, y: bounds.height); graphics.scaleBy(x: 1, y: -1)
        graphics.clip(to: target)
        graphics.translateBy(x: target.minX, y: target.minY); graphics.scaleBy(x: scale, y: scale)
        graphics.translateBy(x: -displayRegion.minX, y: -displayRegion.minY)
        graphics.concatenate(pageTransform)
        let ink = worksheet.drawings[worksheet.page].flatMap { try? PKDrawing(data: $0) }
        TeachingPageRenderer.draw(page, ink: ink, in: graphics)
        graphics.restoreGState()
    }
}

@MainActor final class ClassroomSceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.frame = windowScene.effectiveGeometry.coordinateSpace.bounds
        window.rootViewController = UIHostingController(rootView: ClassroomView())
        window.isHidden = false; self.window = window
    }
}
