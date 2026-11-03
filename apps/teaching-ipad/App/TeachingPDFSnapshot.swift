import CryptoKit
import PDFKit
import PencilKit
import TeachingCore

/// The protected, immutable bytes used by both the preview and the eventual upload.
struct TeachingPDFSnapshot {
    let url: URL
    let pageCount: Int
    let visiblePageCount: Int
    let sizeBytes: Int
    let sha256: String
}

@MainActor enum TeachingPDFSnapshots {
    private struct Metadata: Codable {
        let pageCount: Int
        let visiblePageCount: Int
    }
    static func hasLocalEdits(_ document: CachedDocument, sessionID: UUID, store: LessonStore) throws -> Bool {
        if try store.hasPageEdits(sessionID: sessionID, document: document) { return true }
        let pdf = PDFDocument(url: try store.documentURL(sessionID: sessionID, document: document))
        for index in 0..<(pdf?.pageCount ?? 0) {
            if let data = try store.drawing(sessionID: sessionID, document: document, page: index),
               !(try PKDrawing(data: data)).strokes.isEmpty { return true }
        }
        return false
    }
    static func prepare(_ document: CachedDocument, sessionID: UUID, store: LessonStore, namespace: String,
                        tutorID: UUID, annotations: Bool, blankPages: Bool) throws -> TeachingPDFSnapshot {
        let source = try Data(contentsOf: store.documentURL(sessionID: sessionID, document: document))
        guard let pdf = PDFDocument(data: source), !pdf.isLocked, pdf.pageCount > 0 else {
            throw APIError(status: 0, message: "This PDF could not be prepared.")
        }
        var digest = SHA256()
        digest.update(data: Data("teaching-snapshot-v1:\(annotations):\(blankPages)".utf8)); digest.update(data: source)
        var drawings: [PKDrawing?] = []
        for index in 0..<pdf.pageCount {
            let data = annotations ? try store.drawing(sessionID: sessionID, document: document, page: index) : nil
            digest.update(data: Data("page:\(index):".utf8)); digest.update(data: data ?? Data())
            drawings.append(try data.map { try PKDrawing(data: $0) })
        }
        let key = digest.finalize().map { String(format: "%02x", $0) }.joined()
        // Purgeable cache, scoped like the protected lesson originals. Reusing exact bytes
        // avoids regenerated PDF timestamps changing retry identity after app relaunch.
        let base = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("TeachingSnapshots/\(namespace)/\(tutorID)/\(sessionID)/\(document.id)", isDirectory: true)
        let folder = base.appendingPathComponent(key, isDirectory: true)
        let url = folder.appendingPathComponent("snapshot.pdf")
        let metadataURL = folder.appendingPathComponent("snapshot.json")
        if let metadata = try? JSONDecoder().decode(Metadata.self, from: Data(contentsOf: metadataURL)),
           let bytes = try? Data(contentsOf: url), !bytes.isEmpty {
            return snapshot(url, bytes: bytes, metadata: metadata)
        }
        var pages: [(PDFPage, PKDrawing?, CGRect)] = []
        var visibleCount = 0
        for index in 0..<pdf.pageCount {
            guard let page = pdf.page(at: index), let reference = page.pageRef else {
                throw APIError(status: 0, message: "A PDF page could not be prepared.")
            }
            let crop = reference.getBoxRect(.cropBox)
            let size = abs(reference.rotationAngle) % 180 == 90 ? CGSize(width: crop.height, height: crop.width) : crop.size
            guard size.width > 0, size.height > 0, size.width.isFinite, size.height.isFinite else {
                throw APIError(status: 0, message: "This PDF has an invalid page size.")
            }
            let bounds = CGRect(origin: .zero, size: size)
            let visible = try hasVisibleContent(page, ink: drawings[index], bounds: bounds, annotations: annotations)
            if visible { visibleCount += 1 }
            if visible || blankPages { pages.append((page, drawings[index], bounds)) }
        }
        guard !pages.isEmpty else { throw APIError(status: 0, message: "No visible pages to print. Include annotations or blank pages to continue.") }
        let bytes = UIGraphicsPDFRenderer(bounds: .zero).pdfData { renderer in
            for (page, ink, bounds) in pages {
                renderer.beginPage(withBounds: bounds, pageInfo: [:])
                draw(page, ink: ink, bounds: bounds, annotations: annotations, in: renderer.cgContext)
            }
        }
        guard bytes.count <= 50 * 1024 * 1024 else { throw APIError(status: 0, message: "The prepared PDF is larger than 50 MB. Choose a smaller document.") }
        let metadata = Metadata(pageCount: pages.count, visiblePageCount: visibleCount)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        let staging = base.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: staging) }
        try bytes.write(to: staging.appendingPathComponent("snapshot.pdf"), options: [.atomic, .completeFileProtection])
        try JSONEncoder().encode(metadata).write(to: staging.appendingPathComponent("snapshot.json"), options: [.atomic, .completeFileProtection])
        if FileManager.default.fileExists(atPath: folder.path) { try FileManager.default.removeItem(at: folder) }
        try FileManager.default.moveItem(at: staging, to: folder)
        return snapshot(url, bytes: bytes, metadata: metadata)
    }
    private static func snapshot(_ url: URL, bytes: Data, metadata: Metadata) -> TeachingPDFSnapshot {
        TeachingPDFSnapshot(url: url, pageCount: metadata.pageCount, visiblePageCount: metadata.visiblePageCount,
                            sizeBytes: bytes.count, sha256: SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined())
    }
    private static func draw(_ page: PDFPage, ink: PKDrawing?, bounds: CGRect, annotations: Bool, in graphics: CGContext) {
        guard let reference = page.pageRef else { return }
        graphics.saveGState()
        graphics.translateBy(x: 0, y: bounds.height); graphics.scaleBy(x: 1, y: -1)
        graphics.concatenate(reference.getDrawingTransform(.cropBox, rect: bounds, rotate: 0, preserveAspectRatio: true))
        TeachingPageRenderer.draw(page, ink: ink, includeAnnotations: annotations, in: graphics)
        graphics.restoreGState()
    }
    private static func hasVisibleContent(_ page: PDFPage, ink: PKDrawing?, bounds: CGRect, annotations: Bool) throws -> Bool {
        // Rasterize the actual output, including scans and selected ink. Text extraction
        // would incorrectly discard image-only worksheets and handwriting-only pages.
        let scale = min(150.0 / 72.0, 4096 / max(bounds.width, bounds.height))
        let width = max(1, Int(ceil(bounds.width * scale))), height = max(1, Int(ceil(bounds.height * scale)))
        var pixels = [UInt8](repeating: 255, count: width * height)
        return try pixels.withUnsafeMutableBytes { buffer in
            guard let graphics = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else {
                throw APIError(status: 0, message: "Could not check this PDF's blank pages.")
            }
            graphics.setFillColor(gray: 1, alpha: 1); graphics.fill(CGRect(x: 0, y: 0, width: width, height: height))
            graphics.translateBy(x: 0, y: CGFloat(height)); graphics.scaleBy(x: scale, y: -scale)
            draw(page, ink: ink, bounds: bounds, annotations: annotations, in: graphics)
            return buffer.contains { $0 < 250 }
        }
    }
}
