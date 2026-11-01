import Foundation
import CoreGraphics
import CoreText
import PDFKit

// Synthetic worksheets only; run on macOS when preparing the owned local preview.
for (filename, title, solution) in [("worksheet.pdf", "Differentiation practice", false), ("solutions.pdf", "Worked solutions", true)] {
    let output = URL(fileURLWithPath: CommandLine.arguments[1]).appendingPathComponent(filename)
    var page = CGRect(x: 0, y: 0, width: 612, height: 792)
    guard let consumer = CGDataConsumer(url: output as CFURL), let context = CGContext(consumer: consumer, mediaBox: &page, nil) else { fatalError("Could not create fixture PDF") }
    for index in 1...3 {
        context.beginPDFPage(nil)
        let lines = ["ALTITUTOR - FICTIONAL PREVIEW", title, "Page \(index)", "", "\(index). Find the derivative of f(x) = 3x^2 + 4x - 2.", solution ? "f'(x) = 6x + 4" : "Show your working below.", "", "Explain how the gradient changes as x increases."]
        for (line, text) in lines.enumerated() {
            let font = CTFontCreateWithName("Helvetica" as CFString, line == 1 ? 25 : 14, nil)
            let attributes = [kCTFontAttributeName as NSAttributedString.Key: font]
            let value = NSAttributedString(string: text, attributes: attributes)
            context.textPosition = CGPoint(x: 55, y: 730 - line * 48)
            CTLineDraw(CTLineCreateWithAttributedString(value), context)
        }
        context.endPDFPage()
    }
    context.closePDF()
    // Page 2 exercises source rotation/crop geometry independently of the viewer's rotation preference.
    if let pdf = PDFDocument(url: output), let rotated = pdf.page(at: 1) {
        rotated.setBounds(CGRect(x: 30, y: 40, width: 552, height: 712), for: .cropBox)
        rotated.rotation = 90
        let mark = PDFAnnotation(bounds: CGRect(x: 100, y: 350, width: 50, height: 50), forType: .square, withProperties: nil)
        mark.color = .systemRed; mark.interiorColor = .systemRed
        rotated.addAnnotation(mark)
        guard pdf.write(to: output) else { fatalError("Could not write rotated fixture") }
    }
}
