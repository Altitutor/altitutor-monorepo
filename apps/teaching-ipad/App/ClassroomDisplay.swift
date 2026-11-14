import SwiftUI
import PDFKit

struct ClassroomLesson {
    let title: String; let time: String; let room: String; let tutor: String
}
/// The only capturable surface is the active worksheet PDFView, never its parent or window.
@MainActor final class ClassroomWorksheet {
    let id: UUID
    weak var source: PDFView?
    init(id: UUID, source: PDFView) { self.id = id; self.source = source }
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
    func publishWorksheet(id: UUID, source: PDFView) {
        guard allowedWorksheet == id else { return }
        if worksheet?.id != id || worksheet?.source !== source {
            worksheet = ClassroomWorksheet(id: id, source: source)
        }
    }
    func source(for presentation: ClassroomWorksheet) -> PDFView? {
        guard allowedWorksheet == presentation.id, worksheet === presentation else { return nil }
        return presentation.source
    }
    func stopWorksheet(id: UUID, source: PDFView?) {
        if worksheet?.id == id, worksheet?.source === source { worksheet = nil }
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

/// Project rendered worksheet pixels so PencilKit's uncommitted stroke is visible too.
@MainActor final class ClassroomPDFCanvas: UIView {
    private var worksheet: ClassroomWorksheet?
    private var snapshot: UIView?
    private var displayLink: CADisplayLink?

    func show(_ next: ClassroomWorksheet) {
        if worksheet !== next { snapshot?.removeFromSuperview(); snapshot = nil }
        worksheet = next
        backgroundColor = .black; clipsToBounds = true; isUserInteractionEnabled = false
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        displayLink?.invalidate(); displayLink = nil
        guard window != nil else { snapshot?.removeFromSuperview(); snapshot = nil; return }
        let target = ClassroomFrameTarget(); target.canvas = self
        let link = CADisplayLink(target: target, selector: #selector(ClassroomFrameTarget.refresh(_:)))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 15, maximum: 30, preferred: 30)
        // Default-mode timers stop while UIKit tracks Pencil and pinch gestures.
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    fileprivate func refresh() {
        guard let worksheet, let source = ClassroomState.shared.source(for: worksheet),
              source.window?.windowScene?.activationState == .foregroundActive,
              !source.isHidden, source.bounds.width > 0, source.bounds.height > 0,
              bounds.width > 0, bounds.height > 0 else {
            snapshot?.removeFromSuperview(); snapshot = nil; return
        }
        // Capture only this PDFView's render-server surface. Drawing data omits the stroke
        // still under the Pencil, and rendering its layer does not capture PencilKit's ink.
        guard let next = source.snapshotView(afterScreenUpdates: false) else { return }
        next.bounds = CGRect(origin: .zero, size: source.bounds.size)
        let scale = min(bounds.width / source.bounds.width, bounds.height / source.bounds.height)
        next.transform = CGAffineTransform(scaleX: scale, y: scale)
        next.center = CGPoint(x: bounds.midX, y: bounds.midY)
        addSubview(next)
        snapshot?.removeFromSuperview(); snapshot = next
    }
}

/// The run loop retains the display link; its target must not retain the audience view.
@MainActor private final class ClassroomFrameTarget: NSObject {
    weak var canvas: ClassroomPDFCanvas?
    @objc func refresh(_ link: CADisplayLink) {
        guard let canvas else { link.invalidate(); return }
        canvas.refresh()
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
