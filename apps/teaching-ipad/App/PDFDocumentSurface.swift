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
    let laserMode: TeachingLaserMode
    let navigation: PDFPageNavigation
    let onEdit: () -> Void
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
        context.coordinator.updateInputMode()
    }
    static func dismantleUIView(_ view: PDFView, coordinator: Coordinator) { coordinator.stop() }

    @MainActor final class Coordinator: NSObject, @MainActor PDFPageOverlayViewProvider, PKCanvasViewDelegate, UIGestureRecognizerDelegate {
        var parent: PDFDocumentSurface
        weak var view: PDFView?
        var canvases: [Int: PKCanvasView] = [:]
        private let toolPicker = PKToolPicker()
        private lazy var fitTap = UITapGestureRecognizer(target: self, action: #selector(zoomToFit(_:)))
        private lazy var laserGesture = TeachingLaserGesture(target: self, action: #selector(pointLaser(_:)))
        private let laserOverlay = TeachingLaserOverlay()
        private var laserTrace = TeachingLaserTrace()
        private var laserMode = TeachingLaserMode.off
        private var laserFadeTask: Task<Void, Never>?
        private var timer: Timer?
        private weak var scrollingView: UIScrollView?
        private var toolPresentation = 0
        private var toolsPaused = false
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
        private var resumeObserver: NSObjectProtocol?
        init(_ parent: PDFDocumentSurface) { self.parent = parent }
        func attach(_ view: PDFView) {
            self.view = view
            fitTap.numberOfTapsRequired = 2
            fitTap.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
            fitTap.delegate = self
            view.addGestureRecognizer(fitTap)
            laserGesture.delegate = self
            view.addGestureRecognizer(laserGesture)
            updateInputMode()
            do {
                let url = try parent.store.documentURL(sessionID: parent.sessionID, document: parent.document)
                guard let pdf = PDFDocument(url: url), !pdf.isLocked, pdf.pageCount > 0 else { throw APIError(status: 0, message: "This PDF could not be opened or needs a password.") }
                parent.navigation.editor = self
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
                    MainActor.assumeIsolated {
                        guard let self else { return }
                        self.persist(); self.toolsPaused = true; self.hideTools(); self.updateInputMode()
                    }
                }
                resumeObserver = NotificationCenter.default.addObserver(forName: Notification.Name("TeachingResumePDF"), object: nil, queue: .main) { [weak self] event in
                    let documentID = event.object as? UUID
                    MainActor.assumeIsolated {
                        guard let self, self.active, documentID != nil,
                              !self.parent.isWorksheet || documentID == self.parent.document.id else { return }
                        self.toolsPaused = false; self.updateInputMode()
                        if let pdf = self.view?.document, let page = self.view?.currentPage,
                           let canvas = self.canvases[pdf.index(for: page)] { self.showTools(for: canvas) }
                    }
                }
                closeObserver = NotificationCenter.default.addObserver(forName: Notification.Name("TeachingClosePDF"), object: nil, queue: .main) { [weak self] event in
                    let ids = event.object as? [UUID] ?? []
                    MainActor.assumeIsolated {
                        guard let self, ids.contains(self.parent.document.id) else { return }
                        self.stop(persistChanges: false)
                    }
                }
                backgroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
                    MainActor.assumeIsolated { self?.persist(); self?.clearLaser() }
                }
            } catch { parent.onError(error) }
        }
        func updateInputMode() {
            let next = active && !toolsPaused ? parent.laserMode : .off
            let enabled = next != .off
            if laserMode != next {
                laserMode = next
                laserGesture.isEnabled = false
                clearLaser()
            }
            laserGesture.isEnabled = enabled
            for canvas in canvases.values { canvas.isDrawingEnabled = !enabled }
        }

        func gestureRecognizer(_ gesture: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            if gesture === laserGesture {
                return touch.type == .pencil || (touch.type == .direct && !UIPencilInteraction.prefersPencilOnlyDrawing)
            }
            return true
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                               shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            gestureRecognizer === fitTap && (otherGestureRecognizer as? UITapGestureRecognizer)?.numberOfTapsRequired == 2
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            (gestureRecognizer === laserGesture && (otherGestureRecognizer is UIPinchGestureRecognizer || otherGestureRecognizer === fitTap))
                || (gestureRecognizer === fitTap && otherGestureRecognizer === laserGesture)
        }

        @objc private func zoomToFit(_ gesture: UITapGestureRecognizer) {
            guard active, let view, let page = view.page(for: gesture.location(in: view), nearest: false) else { return }
            fit(page)
        }

        func fitCurrentPage() {
            if let page = view?.currentPage { fit(page) }
        }

        private func fit(_ page: PDFPage) {
            guard active, let view, let pdf = view.document else { return }
            let fit = view.scaleFactorForSizeToFit
            guard fit.isFinite, fit > 0 else { return }
            view.autoScales = false
            view.scaleFactor = fit
            view.go(to: page)
            view.scaleFactor = fit
            parent.navigation.activity(page: pdf.index(for: page), count: pdf.pageCount)
        }

        @objc private func pointLaser(_ gesture: TeachingLaserGesture) {
            guard active, !toolsPaused, laserMode != .off, let view, let pdf = view.document else { return }
            switch gesture.state {
            case .began:
                laserFadeTask?.cancel()
                if let end = laserTrace.fadeEndsAt, end <= CACurrentMediaTime() { laserTrace = TeachingLaserTrace() }
                laserTrace.fadeEndsAt = nil
                laserTrace.head = nil
            case .changed, .ended: break
            case .cancelled, .failed:
                clearLaser(); return
            default: return
            }
            for point in gesture.samples {
                if let page = view.page(for: point, nearest: false) {
                    let sample = TeachingLaserTrace.Point(page: pdf.index(for: page), location: view.convert(point, to: page))
                    laserTrace.move(to: sample, mode: laserMode)
                } else { laserTrace.head = nil }
            }
            if gesture.state == .ended {
                guard laserMode == .trail, !laserTrace.strokes.isEmpty else { clearLaser(); return }
                laserTrace.head = nil
                let deadline = CACurrentMediaTime() + TeachingLaserTrace.fadeDuration
                laserTrace.fadeEndsAt = deadline
                laserFadeTask = Task { [weak self] in
                    do { try await Task.sleep(for: .seconds(TeachingLaserTrace.fadeDuration)) }
                    catch { return }
                    guard !Task.isCancelled, self?.laserTrace.fadeEndsAt == deadline else { return }
                    self?.clearLaser()
                }
            }
            renderLaser()
        }

        private func renderLaser() {
            guard let view, let pdf = view.document else { return }
            laserOverlay.show(laserTrace, in: view) { point in
                pdf.page(at: point.page).map { view.convert(point.location, from: $0) }
            }
        }

        private func clearLaser() {
            laserFadeTask?.cancel(); laserFadeTask = nil
            laserTrace = TeachingLaserTrace()
            laserOverlay.clear()
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
            observeScrolling()
            if laserTrace.hasMarks { renderLaser() }
            if !restored {
                restore(lastSaved); lastSize = view.bounds.size; restored = true; lastVisible = current()
                parent.navigation.thumbnailVersion += 1
                parent.navigation.activity(page: min(max(lastSaved.page, 0), (view.document?.pageCount ?? 1) - 1), count: view.document?.pageCount ?? 0)
                return
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
                if let pdf = view.document, let page = view.currentPage {
                    let index = pdf.index(for: page)
                    if state != lastVisible || parent.navigation.page != index {
                        parent.navigation.activity(page: index, count: pdf.pageCount)
                    }
                }
                lastVisible = state
                ticks += 1
                if ticks % 4 == 0 { persist() }
                if parent.isWorksheet {
                    ClassroomState.shared.publishWorksheet(id: parent.document.id, source: view)
                }
            }
        }
        private func observeScrolling() {
            guard scrollingView == nil, let view else { return }
            var candidates = view.subviews
            while !candidates.isEmpty {
                let candidate = candidates.removeFirst()
                if candidate is PKCanvasView { continue }
                if let scroll = candidate as? UIScrollView {
                    scrollingView = scroll
                    scroll.topEdgeEffect.isHidden = true
                    scroll.panGestureRecognizer.addTarget(self, action: #selector(scrollGesture(_:)))
                    return
                }
                candidates.append(contentsOf: candidate.subviews)
            }
        }
        @objc private func scrollGesture(_ gesture: UIPanGestureRecognizer) {
            guard active, let view, let pdf = view.document else { return }
            let page = view.currentPage.map { pdf.index(for: $0) } ?? parent.navigation.page
            switch gesture.state {
            case .began, .changed: parent.navigation.scrolling(true, page: page, count: pdf.pageCount)
            case .ended, .cancelled, .failed: parent.navigation.scrolling(false, page: page, count: pdf.pageCount)
            default: break
            }
        }
        @discardableResult func persist() -> Bool {
            guard restored, active else { return true }
            do {
                let inkChanged = !dirty.isEmpty
                for index in dirty {
                    if let canvas = canvases[index] { try parent.store.saveDrawing(canvas.drawing.dataRepresentation(), sessionID: parent.sessionID, document: parent.document, page: index) }
                }
                dirty.removeAll()
                if inkChanged { parent.navigation.thumbnailVersion += 1 }
                if let viewport = resizeAnchor ?? current(), viewport != lastSaved {
                    try parent.store.saveViewport(viewport, sessionID: parent.sessionID, document: parent.document); lastSaved = viewport
                }
                return true
            } catch { parent.onError(error); return false }
        }
        func stop(persistChanges: Bool = true) {
            guard active else { return }
            if persistChanges { persist() }
            if parent.isWorksheet { ClassroomState.shared.stopWorksheet(id: parent.document.id, source: view) }
            active = false; timer?.invalidate(); timer = nil
            clearLaser()
            scrollingView?.panGestureRecognizer.removeTarget(self, action: #selector(scrollGesture(_:))); scrollingView = nil
            parent.navigation.stop()
            if let backgroundObserver { NotificationCenter.default.removeObserver(backgroundObserver) }
            if let flushObserver { NotificationCenter.default.removeObserver(flushObserver) }
            if let closeObserver { NotificationCenter.default.removeObserver(closeObserver) }
            if let pauseObserver { NotificationCenter.default.removeObserver(pauseObserver) }
            if let resumeObserver { NotificationCenter.default.removeObserver(resumeObserver) }
            hideTools()
            for canvas in canvases.values { toolPicker.removeObserver(canvas) }
            view?.pageOverlayViewProvider = nil
        }
        private func hideTools() {
            toolPresentation += 1
            for canvas in canvases.values { toolPicker.setVisible(false, forFirstResponder: canvas); canvas.resignFirstResponder() }
        }
        func jump(to index: Int) {
            guard active, let pdf = view?.document, let page = pdf.page(at: index) else { return }
            if !restored {
                lastSaved.page = index
                do { try parent.store.saveViewport(lastSaved, sessionID: parent.sessionID, document: parent.document) }
                catch { parent.onError(error); return }
            }
            view?.go(to: page)
            parent.navigation.activity(page: index, count: pdf.pageCount)
            _ = persist()
        }

        func editPages(_ edit: DocumentPageEdit, matching referenceIndex: Int? = nil) {
            guard active, let view, let currentPDF = view.document, persist() else { return }
            do {
                guard let bytes = currentPDF.dataRepresentation(), let pdf = PDFDocument(data: bytes) else {
                    throw APIError(status: 0, message: "Could not prepare this PDF for editing.")
                }
                let count = pdf.pageCount
                for index in 0..<count { pdf.page(at: index)?.rotation = originalRotations[index] }
                switch edit {
                case .insertBlank(let index):
                    guard (0...count).contains(index), let reference = pdf.page(at: min(max(referenceIndex ?? index, 0), count - 1)) else { return }
                    let bounds = CGRect(origin: .zero, size: reference.bounds(for: .cropBox).size)
                    let blank = UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in context.beginPage() }
                    guard let page = PDFDocument(data: blank)?.page(at: 0) else { throw APIError(status: 0, message: "Could not create a blank page.") }
                    page.rotation = reference.rotation
                    pdf.insert(page, at: index)
                case .delete(let index):
                    guard count > 1, (0..<count).contains(index) else { return }
                    pdf.removePage(at: index)
                }
                guard let data = pdf.dataRepresentation() else { throw APIError(status: 0, message: "Could not save this PDF edit.") }
                let viewport = try parent.store.editPages(edit, pdf: data, pageCount: count, sessionID: parent.sessionID, document: parent.document)
                // Teardown callbacks still describe the old PDF; they must not write into the new revision.
                restored = false
                hideTools()
                for canvas in canvases.values { toolPicker.removeObserver(canvas) }
                view.pageOverlayViewProvider = nil; canvases.removeAll(); dirty.removeAll()
                originalRotations = (0..<pdf.pageCount).map { pdf.page(at: $0)?.rotation ?? 0 }
                rotation = viewport.rotation
                for index in 0..<pdf.pageCount { pdf.page(at: index)?.rotation = originalRotations[index] + rotation }
                view.document = pdf; view.pageOverlayViewProvider = self
                lastSaved = viewport; restored = false; resizeAnchor = nil; lastVisible = nil
                parent.navigation.activity(page: viewport.page, count: pdf.pageCount)
                parent.navigation.thumbnailVersion += 1
                if parent.isWorksheet { ClassroomState.shared.allowWorksheet(parent.document.id) }
                parent.onEdit()
            } catch { parent.onError(error) }
        }

        func thumbnail(at index: Int) -> UIImage? {
            guard let page = view?.document?.page(at: index), let reference = page.pageRef else { return nil }
            let crop = reference.getBoxRect(.cropBox)
            let quarterTurn = abs(page.rotation) % 180 == 90
            let size = quarterTurn ? CGSize(width: crop.height, height: crop.width) : crop.size
            guard size.width > 0, size.height > 0 else { return nil }
            let output = CGSize(width: 220, height: 220 * size.height / size.width)
            let ink = canvases[index]?.drawing ?? (try? parent.store.drawing(sessionID: parent.sessionID, document: parent.document, page: index)).flatMap { try? PKDrawing(data: $0) }
            return UIGraphicsImageRenderer(size: output).image { context in
                let graphics = context.cgContext
                graphics.translateBy(x: 0, y: output.height); graphics.scaleBy(x: output.width / size.width, y: -output.height / size.height)
                graphics.concatenate(reference.getDrawingTransform(.cropBox, rect: CGRect(origin: .zero, size: size), rotate: Int32(page.rotation) - reference.rotationAngle, preserveAspectRatio: true))
                TeachingPageRenderer.draw(page, ink: ink, in: graphics)
            }
        }
        func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
            guard let pdf = view.document else { return nil }
            let index = pdf.index(for: page)
            if let canvas = canvases[index] { return canvas }
            let canvas = TeachingCanvasView(frame: page.bounds(for: .cropBox))
            canvas.isOpaque = false; canvas.backgroundColor = .clear; canvas.isScrollEnabled = false
            canvas.drawingPolicy = .default
            canvas.isDrawingEnabled = laserMode == .off
            canvas.drawingGestureRecognizer.require(toFail: laserGesture)
            canvas.tool = PKInkingTool(.pen, color: .systemBlue, width: 2)
            do {
                if let data = try parent.store.drawing(sessionID: parent.sessionID, document: parent.document, page: index) { canvas.drawing = try PKDrawing(data: data) }
            } catch { parent.onError(error); canvas.isUserInteractionEnabled = false }
            canvas.delegate = self; canvases[index] = canvas
            return canvas
        }
        func pdfView(_ pdfView: PDFView, willDisplayOverlayView overlayView: UIView, for page: PDFPage) {
            guard let canvas = overlayView as? TeachingCanvasView else { return }
            toolPicker.addObserver(canvas)
            canvas.didAttachToWindow = { [weak self] canvas in self?.showTools(for: canvas) }
            showTools(for: canvas)
        }
        private func showTools(for canvas: PKCanvasView) {
            guard active, !toolsPaused, canvas.window != nil else { return }
            // Finish PDFKit's attachment callback before presenting scene-owned tools.
            let presentation = toolPresentation
            Task { @MainActor [weak self, weak canvas] in
                guard let self, self.active, !self.toolsPaused, self.toolPresentation == presentation,
                      let canvas, canvas.window != nil else { return }
                if self.parent.isWorksheet { canvas.becomeFirstResponder() }
                self.toolPicker.setVisible(true, forFirstResponder: canvas)
            }
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

/// PDFKit can announce a blank page's overlay before it joins the window.
@MainActor private final class TeachingCanvasView: PKCanvasView {
    var didAttachToWindow: ((PKCanvasView) -> Void)?
    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil { didAttachToWindow?(self) }
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
    static func draw(_ page: PDFPage, ink: PKDrawing?, includeAnnotations: Bool = true, in graphics: CGContext) {
        guard let reference = page.pageRef else { return }
        graphics.saveGState()
        graphics.setFillColor(UIColor.white.cgColor); graphics.fill(reference.getBoxRect(.cropBox))
        graphics.drawPDFPage(reference)
        // PDFAnnotation applies its page rotation internally. The caller already supplies that transform.
        if includeAnnotations {
            let rotation = page.rotation
            page.rotation = 0
            defer { page.rotation = rotation }
            let media = reference.getBoxRect(.mediaBox)
            graphics.saveGState(); graphics.translateBy(x: media.minX, y: media.minY)
            for annotation in page.annotations where annotation.shouldDisplay { annotation.draw(with: .mediaBox, in: graphics) }
            graphics.restoreGState()
        }
        if includeAnnotations, let ink {
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
