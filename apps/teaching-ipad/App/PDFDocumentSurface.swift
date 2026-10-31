import SwiftUI
import PDFKit
import PencilKit
import TeachingCore

@MainActor final class PDFSaveRequest {
    var failed = false
}

struct PDFDocumentSurface: UIViewRepresentable {
    let document: CachedDocument
    let sessionID: UUID
    let store: LessonStore
    let isWorksheet: Bool
    let fingerDrawing: Bool
    let onError: (Error) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.displayMode = .singlePageContinuous; view.displayDirection = .vertical
        view.backgroundColor = .secondarySystemBackground; view.autoScales = true; view.isInMarkupMode = true
        view.minScaleFactor = 0.15; view.maxScaleFactor = 8
        context.coordinator.attach(view)
        return view
    }
    func updateUIView(_ view: PDFView, context: Context) {
        context.coordinator.parent = self
        for canvas in context.coordinator.canvases.values { canvas.drawingPolicy = fingerDrawing ? .anyInput : .pencilOnly }
    }
    static func dismantleUIView(_ view: PDFView, coordinator: Coordinator) { coordinator.stop() }

    @MainActor final class Coordinator: NSObject, @MainActor PDFPageOverlayViewProvider, PKCanvasViewDelegate {
        var parent: PDFDocumentSurface
        weak var view: PDFView?
        var canvases: [Int: PKCanvasView] = [:]
        private let toolPicker = PKToolPicker()
        private var timer: Timer?
        private var dirty = Set<Int>()
        private var lastSaved = DocumentViewport()
        private var rotation = 0
        private var originalRotations: [Int] = []
        private var ticks = 0
        private var restored = false
        private var active = true
        private var lastSize = CGSize.zero
        private var resizeAnchor: DocumentViewport?
        private var sizeChangedAt = Date.distantPast
        private var lastVisible: DocumentViewport?
        private var backgroundObserver: NSObjectProtocol?
        private var flushObserver: NSObjectProtocol?
        private var closeObserver: NSObjectProtocol?
        private var pauseObserver: NSObjectProtocol?
        init(_ parent: PDFDocumentSurface) { self.parent = parent }
        func attach(_ view: PDFView) {
            self.view = view
            do {
                let url = try parent.store.documentURL(sessionID: parent.sessionID, document: parent.document)
                guard let pdf = PDFDocument(url: url), !pdf.isLocked else { throw APIError(status: 0, message: "This PDF could not be opened or needs a password.") }
                originalRotations = (0..<pdf.pageCount).map { pdf.page(at: $0)?.rotation ?? 0 }
                lastSaved = try parent.store.viewport(sessionID: parent.sessionID, document: parent.document); rotation = lastSaved.rotation
                for index in 0..<pdf.pageCount { pdf.page(at: index)?.rotation = originalRotations[index] + rotation }
                view.pageOverlayViewProvider = self; view.document = pdf
                timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
                    MainActor.assumeIsolated { self?.tick() }
                }
                flushObserver = NotificationCenter.default.addObserver(forName: Notification.Name("TeachingFlushPDF"), object: nil, queue: .main) { [weak self] event in
                    let request = event.object as? PDFSaveRequest
                    MainActor.assumeIsolated {
                        if self?.persist() == false { request?.failed = true }
                    }
                }
                pauseObserver = NotificationCenter.default.addObserver(forName: Notification.Name("TeachingPausePDF"), object: nil, queue: .main) { [weak self] _ in
                    MainActor.assumeIsolated { self?.persist(); self?.hideTools() }
                }
                closeObserver = NotificationCenter.default.addObserver(forName: Notification.Name("TeachingClosePDF"), object: nil, queue: .main) { [weak self] event in
                    let ids = event.object as? [UUID] ?? []
                    MainActor.assumeIsolated {
                        guard let self, ids.contains(self.parent.document.id) else { return }
                        self.stop(persistChanges: false)
                    }
                }
                backgroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
                    MainActor.assumeIsolated { _ = self?.persist() }
                }
            } catch { parent.onError(error) }
        }
        private func restore(_ viewport: DocumentViewport) {
            guard let view, let pdf = view.document, let page = pdf.page(at: min(max(viewport.page, 0), pdf.pageCount - 1)) else { return }
            view.autoScales = false
            let scale = viewport.scale > 0 ? viewport.scale : view.scaleFactorForSizeToFit
            view.scaleFactor = scale
            if viewport.scale > 0 { view.go(to: PDFDestination(page: page, at: CGPoint(x: viewport.x, y: viewport.y))) }
            else { view.go(to: page) }
            view.scaleFactor = scale
        }
        private func current() -> DocumentViewport? {
            guard let view, let pdf = view.document else { return nil }
            let origin = CGPoint(x: view.bounds.minX, y: view.bounds.minY)
            guard let page = view.page(for: CGPoint(x: view.bounds.midX, y: view.bounds.minY + 1), nearest: true) else { return nil }
            let point = view.convert(origin, to: page)
            return DocumentViewport(page: pdf.index(for: page), x: point.x, y: point.y,
                                    scale: view.scaleFactor, rotation: rotation)
        }
        private func tick() {
            guard active, let view, view.bounds.width > 0, view.bounds.height > 0, view.document != nil else { return }
            if !restored {
                restore(lastSaved); lastSize = view.bounds.size; restored = true; lastVisible = current(); return
            }
            // PDFKit lays itself out while the divider moves. Repeated go(to:) during that
            // layout fights the drag and saves intermediate positions. Restore once it settles.
            if view.bounds.size != lastSize {
                if resizeAnchor == nil { resizeAnchor = lastVisible ?? lastSaved }
                lastSize = view.bounds.size; sizeChangedAt = Date(); return
            }
            if let anchor = resizeAnchor {
                guard Date().timeIntervalSince(sizeChangedAt) >= 0.18 else { return }
                restore(anchor); resizeAnchor = nil; lastVisible = current(); return
            }
            if let state = current() {
                lastVisible = state
                ticks += 1
                if ticks % 4 == 0 { persist() }
                if parent.isWorksheet, let pdf = view.document,
                   let page = view.page(for: CGPoint(x: view.bounds.midX, y: view.bounds.midY), nearest: true) {
                    let pageIndex = pdf.index(for: page)
                    let rect = view.convert(view.bounds, to: page).intersection(page.bounds(for: .cropBox))
                    var drawings: [Int: Data] = [:]
                    for index in [pageIndex] {
                        drawings[index] = canvases[index]?.drawing.dataRepresentation() ?? (try? parent.store.drawing(sessionID: parent.sessionID, document: parent.document, page: index))
                    }
                    do {
                        ClassroomState.shared.publishWorksheet(id: parent.document.id,
                            url: try parent.store.documentURL(sessionID: parent.sessionID, document: parent.document),
                            page: pageIndex, visibleRect: rect, rotation: rotation, drawings: drawings)
                    } catch { parent.onError(error) }
                }
            }
        }
        @discardableResult func persist() -> Bool {
            guard restored, active else { return true }
            do {
                for index in dirty {
                    if let canvas = canvases[index] { try parent.store.saveDrawing(canvas.drawing.dataRepresentation(), sessionID: parent.sessionID, document: parent.document, page: index) }
                }
                dirty.removeAll()
                if let viewport = resizeAnchor ?? current(), viewport != lastSaved {
                    try parent.store.saveViewport(viewport, sessionID: parent.sessionID, document: parent.document); lastSaved = viewport
                }
                return true
            } catch { parent.onError(error); return false }
        }
        func stop(persistChanges: Bool = true) {
            guard active else { return }
            if persistChanges { persist() }
            active = false; timer?.invalidate(); timer = nil
            if let backgroundObserver { NotificationCenter.default.removeObserver(backgroundObserver) }
            if let flushObserver { NotificationCenter.default.removeObserver(flushObserver) }
            if let closeObserver { NotificationCenter.default.removeObserver(closeObserver) }
            if let pauseObserver { NotificationCenter.default.removeObserver(pauseObserver) }
            hideTools()
            for canvas in canvases.values { toolPicker.removeObserver(canvas) }
            view?.pageOverlayViewProvider = nil
        }
        private func hideTools() {
            for canvas in canvases.values { toolPicker.setVisible(false, forFirstResponder: canvas); canvas.resignFirstResponder() }
        }
        func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
            guard let pdf = view.document else { return nil }
            let index = pdf.index(for: page)
            if let canvas = canvases[index] { return canvas }
            let canvas = PKCanvasView(frame: page.bounds(for: .cropBox))
            canvas.isOpaque = false; canvas.backgroundColor = .clear; canvas.isScrollEnabled = false
            canvas.drawingPolicy = parent.fingerDrawing ? .anyInput : .pencilOnly
            canvas.tool = PKInkingTool(.pen, color: .systemBlue, width: 2)
            do {
                if let data = try parent.store.drawing(sessionID: parent.sessionID, document: parent.document, page: index) { canvas.drawing = try PKDrawing(data: data) }
            } catch { parent.onError(error); canvas.isUserInteractionEnabled = false }
            canvas.delegate = self; canvases[index] = canvas
            return canvas
        }
        func pdfView(_ pdfView: PDFView, willDisplayOverlayView overlayView: UIView, for page: PDFPage) {
            guard let canvas = overlayView as? PKCanvasView else { return }
            toolPicker.addObserver(canvas); toolPicker.setVisible(true, forFirstResponder: canvas)
            if parent.isWorksheet { canvas.becomeFirstResponder() }
        }
        func pdfView(_ pdfView: PDFView, willEndDisplayingOverlayView overlayView: UIView, for page: PDFPage) { persist() }
        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            if let index = canvases.first(where: { $0.value === canvasView })?.key { dirty.insert(index) }
        }
        func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) {
            toolPicker.setVisible(true, forFirstResponder: canvasView); canvasView.becomeFirstResponder()
        }
    }
}

@MainActor enum AnnotatedPDF {
    static var exportsDirectory: URL { FileManager.default.temporaryDirectory.appendingPathComponent("TeachingExports", isDirectory: true) }
    static func export(_ document: CachedDocument, sessionID: UUID, store: LessonStore) throws -> URL {
        if let external = document.source.externalURL { return external }
        let source = try store.documentURL(sessionID: sessionID, document: document)
        guard document.source.isPDF else { return source }
        guard let pdf = PDFDocument(url: source), !pdf.isLocked else { throw APIError(status: 0, message: "Could not open this PDF for sharing.") }
        let drawings: [PKDrawing?] = try (0..<pdf.pageCount).map { index in
            guard let bytes = try store.drawing(sessionID: sessionID, document: document, page: index) else { return nil }
            return try PKDrawing(data: bytes)
        }
        let data = UIGraphicsPDFRenderer(bounds: .zero).pdfData { context in
            for index in 0..<pdf.pageCount {
                guard let page = pdf.page(at: index) else { continue }
                guard let reference = page.pageRef else { continue }
                let crop = reference.getBoxRect(.cropBox)
                let quarterTurn = abs(reference.rotationAngle) % 180 == 90
                let size = quarterTurn ? CGSize(width: crop.height, height: crop.width) : crop.size
                let bounds = CGRect(origin: .zero, size: size)
                context.beginPage(withBounds: bounds, pageInfo: [:])
                let graphics = context.cgContext
                graphics.saveGState()
                graphics.translateBy(x: 0, y: size.height); graphics.scaleBy(x: 1, y: -1)
                graphics.concatenate(reference.getDrawingTransform(.cropBox, rect: bounds, rotate: 0, preserveAspectRatio: true))
                TeachingPageRenderer.draw(page, ink: drawings[index], in: graphics)
                graphics.restoreGState()
            }
        }
        let folder = exportsDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let name = URL(fileURLWithPath: document.source.title).deletingPathExtension().lastPathComponent
        let output = folder.appendingPathComponent("\(name.isEmpty ? "Worksheet" : name) — annotated.pdf")
        try data.write(to: output, options: [.atomic, .completeFileProtection])
        return output
    }
}

/// Draw in canonical PDF page coordinates; the caller supplies crop/rotation/viewport transforms.
@MainActor enum TeachingPageRenderer {
    static func draw(_ page: PDFPage, ink: PKDrawing?, in graphics: CGContext) {
        guard let reference = page.pageRef else { return }
        graphics.saveGState()
        graphics.setFillColor(UIColor.white.cgColor); graphics.fill(reference.getBoxRect(.cropBox))
        graphics.drawPDFPage(reference)
        // PDFAnnotation applies its page rotation internally. The caller already supplies that transform.
        do {
            let rotation = page.rotation
            page.rotation = 0
            defer { page.rotation = rotation }
            let media = reference.getBoxRect(.mediaBox)
            graphics.saveGState(); graphics.translateBy(x: media.minX, y: media.minY)
            for annotation in page.annotations where annotation.shouldDisplay { annotation.draw(with: .mediaBox, in: graphics) }
            graphics.restoreGState()
        }
        if let ink {
            let crop = reference.getBoxRect(.cropBox)
            graphics.saveGState()
            graphics.translateBy(x: crop.minX, y: crop.maxY); graphics.scaleBy(x: 1, y: -1)
            let bounds = CGRect(origin: .zero, size: crop.size)
            ink.image(from: bounds, scale: 2).draw(in: bounds)
            graphics.restoreGState()
        }
        graphics.restoreGState()
    }
}
