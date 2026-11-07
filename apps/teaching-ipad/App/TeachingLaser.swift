import UIKit
import UIKit.UIGestureRecognizerSubclass

enum TeachingLaserMode {
    case off, dot, trail

    var next: Self {
        switch self {
        case .off: .dot
        case .dot: .trail
        case .trail: .off
        }
    }
    var label: String {
        switch self {
        case .off: "Off"
        case .dot: "Dot"
        case .trail: "Trail"
        }
    }
    var hint: String {
        switch self {
        case .off: "Switch to laser dot"
        case .dot: "Switch to laser trail"
        case .trail: "Turn off the laser"
        }
    }
    var symbol: String {
        switch self {
        case .off: "dot.scope"
        case .dot: "scope"
        case .trail: "scribble"
        }
    }
}

struct TeachingLaserTrace: Equatable {
    struct Point: Equatable {
        let page: Int
        let location: CGPoint
    }

    static let fadeDuration: TimeInterval = 1.5
    var strokes: [[Point]] = []
    var head: Point?
    var fadeEndsAt: CFTimeInterval?
    var hasMarks: Bool { head != nil || !strokes.isEmpty }

    mutating func move(to point: Point, mode: TeachingLaserMode) {
        if mode == .trail {
            if head?.page == point.page, let index = strokes.indices.last {
                if strokes[index].count >= 4096 {
                    strokes[index] = strokes[index].enumerated().compactMap { offset, point in
                        offset.isMultiple(of: 2) ? point : nil
                    }
                }
                if strokes[index].last != point { strokes[index].append(point) }
            } else {
                if strokes.count >= 64 { strokes.removeFirst() }
                strokes.append([point])
            }
        }
        head = point
    }
}

/// Begin on contact and use UIKit’s coalesced samples for fast Pencil movement.
@MainActor final class TeachingLaserGesture: UIGestureRecognizer {
    private weak var trackedTouch: UITouch?
    private(set) var samples: [CGPoint] = []

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        guard trackedTouch == nil, touches.count == 1, let touch = touches.first else {
            state = state == .possible ? .failed : .cancelled
            return
        }
        trackedTouch = touch
        samples = [touch.location(in: view)]
        state = .began
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let touch = trackedTouch, touches.contains(touch) else { return }
        samples = (event.coalescedTouches(for: touch) ?? [touch]).map { $0.location(in: view) }
        state = .changed
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let touch = trackedTouch, touches.contains(touch) else { return }
        samples = [touch.location(in: view)]
        state = .ended
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        state = .cancelled
    }

    override func reset() {
        super.reset()
        trackedTouch = nil
        samples = []
    }
}

/// Both displays draw an ephemeral overlay. The PDF and its saved ink stay untouched.
@MainActor final class TeachingLaserOverlay {
    private let overlay = CALayer()
    private let outline = CAShapeLayer()
    private let line = CAShapeLayer()
    private let dot = CALayer()
    private var fadeEndsAt: CFTimeInterval?

    init() {
        overlay.masksToBounds = true
        for stroke in [outline, line] {
            stroke.fillColor = nil
            stroke.lineCap = .round
            stroke.lineJoin = .round
            overlay.addSublayer(stroke)
        }
        outline.strokeColor = UIColor.white.cgColor; outline.lineWidth = 7
        line.strokeColor = UIColor.systemRed.cgColor; line.lineWidth = 4
        dot.bounds = CGRect(x: 0, y: 0, width: 14, height: 14)
        dot.cornerRadius = 7; dot.backgroundColor = UIColor.systemRed.cgColor
        dot.borderColor = UIColor.white.cgColor; dot.borderWidth = 2
        overlay.addSublayer(dot)
    }

    func show(_ trace: TeachingLaserTrace, in view: UIView, project: (TeachingLaserTrace.Point) -> CGPoint?) {
        guard trace.hasMarks else { clear(); return }
        if overlay.superlayer == nil { view.layer.addSublayer(overlay) }
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        overlay.frame = view.bounds
        let path = CGMutablePath()
        for stroke in trace.strokes {
            var previous: CGPoint?
            for point in stroke {
                guard let position = project(point) else { previous = nil; continue }
                if previous == nil {
                    path.move(to: position)
                    path.addLine(to: CGPoint(x: position.x + 0.01, y: position.y))
                } else { path.addLine(to: position) }
                previous = position
            }
        }
        outline.path = path; line.path = path
        if let head = trace.head.flatMap(project) {
            dot.position = head
            dot.isHidden = false
        } else { dot.isHidden = true }
        if fadeEndsAt != trace.fadeEndsAt {
            fadeEndsAt = trace.fadeEndsAt
            overlay.removeAnimation(forKey: "laserFade")
            if let fadeEndsAt {
                let remaining = max(0, fadeEndsAt - CACurrentMediaTime())
                overlay.opacity = 0
                if remaining > 0 {
                    let fade = CABasicAnimation(keyPath: "opacity")
                    fade.fromValue = min(1, remaining / TeachingLaserTrace.fadeDuration)
                    fade.toValue = 0
                    fade.duration = remaining
                    fade.timingFunction = CAMediaTimingFunction(name: .linear)
                    overlay.add(fade, forKey: "laserFade")
                }
            } else { overlay.opacity = 1 }
        }
        CATransaction.commit()
    }

    func clear() {
        overlay.removeAnimation(forKey: "laserFade")
        overlay.opacity = 1
        fadeEndsAt = nil
        overlay.removeFromSuperlayer()
    }
}
