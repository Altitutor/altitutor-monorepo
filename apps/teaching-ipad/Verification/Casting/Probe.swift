import SwiftUI
import PDFKit
import PencilKit
import TeachingCore

// This entry point replaces the app entry point only in the disposable test copy.
@main struct CastingProbe: App {
    var body: some Scene { WindowGroup { ProbeHost().ignoresSafeArea() } }
}

struct ProbeHost: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> ProbeController { ProbeController() }
    func updateUIViewController(_ controller: ProbeController, context: Context) {}
}

@MainActor final class ProbeController: UIViewController {
    private var coordinator: PDFDocumentSurface.Coordinator?
    private let audience = UIHostingController(rootView: ClassroomView())
    private let result = UILabel()
    private var monitor: Timer?
    private var root: URL?
    private var pdf: PDFView?
    private var liveInkSeen = false
    private var beganAt: CFTimeInterval?

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Task { do { try await prepare() } catch { result.text = "ERROR: \(error)" } }
    }

    private func prepare() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        self.root = root
        let session = UUID(), store = try LessonStore(root: root, tutorID: UUID())
        let bytes = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 600, height: 800)).pdfData { context in
            context.beginPage()
            UIColor.white.setFill(); context.cgContext.fill(CGRect(x: 0, y: 0, width: 600, height: 800))
            ("Classroom worksheet" as NSString).draw(at: CGPoint(x: 40, y: 50), withAttributes: [.font: UIFont.systemFont(ofSize: 32)])
        }
        let document = try store.addLocalDocument(title: "Worksheet.pdf", to: session, pdf: bytes).resources[0].worksheet
        let pdf = PDFView(frame: CGRect(x: 0, y: 0, width: view.bounds.width, height: view.bounds.height / 2))
        self.pdf = pdf
        pdf.displayMode = .singlePageContinuous; pdf.displayDirection = .vertical
        pdf.autoScales = true; pdf.isInMarkupMode = true
        pdf.accessibilityIdentifier = "worksheet"
        view.addSubview(pdf)
        addChild(audience)
        audience.view.frame = CGRect(x: 0, y: view.bounds.height / 2, width: view.bounds.width, height: view.bounds.height / 2)
        view.addSubview(audience.view); audience.didMove(toParent: self)
        result.frame = CGRect(x: 0, y: view.bounds.height - 45, width: view.bounds.width, height: 45)
        result.backgroundColor = .white; result.text = "preparing"; result.accessibilityIdentifier = "casting-result"
        view.addSubview(result)
        ClassroomState.shared.allowWorksheet(document.id)
        let worksheet = !ProcessInfo.processInfo.arguments.contains("solutions-probe")
        let surface = PDFDocumentSurface(document: document, sessionID: session, store: store, isWorksheet: worksheet,
            laserMode: .off, navigation: PDFPageNavigation(), onEdit: {}, onError: { [weak self] error in self?.result.text = "ERROR: \(error)" })
        let coordinator = surface.makeCoordinator(); self.coordinator = coordinator; coordinator.attach(pdf)
        try await Task.sleep(for: .seconds(1))
        for canvas in coordinator.canvases.values {
            canvas.drawingPolicy = .anyInput
            canvas.tool = PKInkingTool(.pen, color: .red, width: 12)
            canvas.drawingGestureRecognizer.addTarget(self, action: #selector(ink(_:)))
        }
        let timer = Timer(timeInterval: 0.1, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            MainActor.assumeIsolated { self.sample() }
        }
        monitor = timer; RunLoop.main.add(timer, forMode: .common)
        if !worksheet {
            result.text = ClassroomState.shared.worksheet == nil ? "solutions-private" : "FAIL: solutions visible"
        } else if ProcessInfo.processInfo.arguments.contains("zoom-probe") {
            try await Task.sleep(for: .seconds(0.5))
            checkZoom(pdf)
        } else { result.text = "ready-for-ink" }
    }

    @objc private func ink(_ gesture: UIGestureRecognizer) {
        if gesture.state == .began { beganAt = CACurrentMediaTime() }
        if gesture.state == .ended || gesture.state == .cancelled {
            sample()
            result.text = liveInkSeen ? "ink-before-lift" : "FAIL: ink appeared only after lift"
            beganAt = nil
        }
    }

    private func sample() {
        guard let beganAt, CACurrentMediaTime() - beganAt > 0.3,
              coordinator?.canvases.values.contains(where: { $0.drawingGestureRecognizer.state == .changed }) == true,
              let pdf else { return }
        // Observe rendered pixels while UIKit's real continuous touch is still down.
        if redPixels(in: pdf) > 100, redPixels(in: audience.view) > 100 { liveInkSeen = true }
    }

    private func image(_ target: UIView) -> UIImage {
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        return UIGraphicsImageRenderer(size: target.bounds.size, format: format).image { _ in
            target.drawHierarchy(in: target.bounds, afterScreenUpdates: false)
        }
    }

    private func redPixels(in target: UIView) -> Int {
        guard let image = image(target).cgImage else { return 0 }
        let width = image.width, height = image.height
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        return pixels.withUnsafeMutableBytes { buffer in
            guard let graphics = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return 0 }
            graphics.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            let bytes = buffer.bindMemory(to: UInt8.self)
            return stride(from: 0, to: bytes.count, by: 4).reduce(0) { count, index in
                count + (bytes[index] > 180 && bytes[index + 1] < 100 && bytes[index + 2] < 100 ? 1 : 0)
            }
        }
    }

    private func checkZoom(_ pdf: PDFView) {
        let sourceBefore = image(pdf).pngData(), audienceBefore = image(audience.view).pngData()
        pdf.scaleFactor *= 1.5
        let until = Date().addingTimeInterval(0.6)
        while Date() < until { RunLoop.current.run(mode: .tracking, before: until) }
        let changed = sourceBefore != image(pdf).pngData() && audienceBefore != image(audience.view).pngData()
        result.text = changed ? "zoom-during-gesture" : "FAIL: cast froze during gesture"
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        monitor?.invalidate(); coordinator?.stop(); ClassroomState.shared.clear()
        if let root { try? FileManager.default.removeItem(at: root) }
    }
}
