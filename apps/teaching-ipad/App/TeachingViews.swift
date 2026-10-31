import SwiftUI
import TeachingCore


enum TeachingMotion {
    static func panel(reduceMotion: Bool) -> Animation {
        reduceMotion ? .easeOut(duration: 0.15) : .spring(response: 0.32, dampingFraction: 1)
    }
}

struct TeachingNavigation: View {
    @ObservedObject var model: TeachingModel
    @State private var library = false
    @State private var log = false
    @State private var preview: TeachingResource?
    @State private var signingOut = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        NavigationStack {
            Group {
                if model.session != nil {
                    surface { LessonBoard(model: model) }
                } else { SessionDayView(model: model) }
            }
            .navigationTitle(model.session?.title ?? "Your teaching day")
            .navigationBarTitleDisplayMode(model.session == nil ? .large : .inline)
            .toolbar {
                if model.session != nil {
                    ToolbarItem(placement: .topBarLeading) {
                        Button { library = false; model.leaveLesson() } label: { Label("Today", systemImage: "chevron.left") }
                    }
                    lessonControls
                } else {
                    ToolbarItem(placement: .topBarTrailing) { Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right") { signingOut = true } }
                }
            }
            .navigationDestination(isPresented: Binding(get: { model.viewer }, set: { if !$0 { model.showBoard() } })) {
                surface { LessonWorkspace(model: model) }
                    .navigationTitle(model.session?.title ?? "Lesson")
                    .navigationBarTitleDisplayMode(.inline).navigationBarBackButtonHidden()
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button { library = false; model.showBoard() } label: { Label("Lesson board", systemImage: "chevron.left") }
                        }
                        lessonControls
                    }
            }
        }
        .sheet(isPresented: $log, onDismiss: { model.allowActiveWorksheet() }) {
            if let session = model.session { TutorLogView(model: model, session: session) }
        }
        .sheet(item: $preview, onDismiss: { model.allowActiveWorksheet() }) { resource in
            LibraryPreview(model: model, resource: resource) { preview = nil }
        }
        .sheet(isPresented: Binding(get: { model.sharedURL != nil }, set: { if !$0 { model.finishSharing() } })) {
            if let url = model.sharedURL { NativeShareSheet(url: url) { model.finishSharing() } }
        }
        .confirmationDialog("Sign out of this teaching iPad?", isPresented: $signingOut) { Button("Sign out", role: .destructive) { model.signOut() } }
        message: { Text("Your local lesson annotations stay on this iPad for your next sign-in.") }
    }
    @ToolbarContentBuilder private var lessonControls: some ToolbarContent {
        if let session = model.session {
            ToolbarItem(placement: .topBarTrailing) {
                Button { library = false; model.showLessonInformation(); log = true } label: { Label(session.logged ? "View log" : "Review log", systemImage: "checklist") }
                    .keyboardShortcut("l", modifiers: .command).accessibilityIdentifier("teaching-log")
            }
            ToolbarSpacer(.fixed, placement: .topBarTrailing)
            ToolbarItem(placement: .topBarTrailing) {
                Button { withAnimation(TeachingMotion.panel(reduceMotion: reduceMotion)) { library.toggle() } } label: { Label("Resources", systemImage: "sidebar.right") }.accessibilityIdentifier("teaching-library")
            }
        }
    }
    private func surface<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content().frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay {
                ResourceDrawer(model: model, isPresented: $library) { resource in
                    model.showLessonInformation(); preview = resource
                }
            }
            .overlay(alignment: .bottom) {
                if model.busy { ProgressView("Working…").padding(12).background(.regularMaterial, in: Capsule()).padding() }
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                if model.offline { Label("Cached lessons · reconnect to search, add resources or submit a log", systemImage: "wifi.slash").font(.footnote).padding(9).frame(maxWidth: .infinity).background(.yellow.opacity(0.15)) }
            }
    }
}

struct SessionDayView: View {
    @ObservedObject var model: TeachingModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    VStack(alignment: .leading) {
                        Text(model.profile?.name ?? "Tutor").font(.title2.bold())
                        Text("Open a lesson to pick up where you left off.").foregroundStyle(.secondary)
                    }
                    Spacer()
                    DatePicker("Teaching date", selection: $model.selectedDate, displayedComponents: .date).labelsHidden()
                        .environment(\.timeZone, TeachingModel.calendar.timeZone)
                    Button { Task { await model.loadSessions() } } label: { Image(systemName: "arrow.clockwise") }.accessibilityLabel("Refresh sessions")
                }
                if model.sessions.isEmpty && !model.busy {
                    ContentUnavailableView("No sessions on this date", systemImage: "calendar", description: Text(model.offline ? "No cached sessions for this date. Reconnect to load your timetable." : "Choose another date or refresh your timetable."))
                }
                ForEach(model.sessions) { session in
                    Button { model.choose(session) } label: {
                        HStack(spacing: 24) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(TeachingModel.time(session.startAt)).font(.title3.bold())
                                Text(TeachingModel.time(session.endAt)).foregroundStyle(.secondary)
                            }.frame(width: 100, alignment: .leading)
                            VStack(alignment: .leading, spacing: 7) {
                                Text(session.title).font(.headline)
                                Text([session.room, session.kind.replacingOccurrences(of: "_", with: " ").capitalized].compactMap { $0 }.joined(separator: " · ")).font(.subheadline).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if session.logged { Label("Logged", systemImage: "checkmark.circle.fill").foregroundStyle(TeachingColors.teal) }
                            Image(systemName: "chevron.right").foregroundStyle(.secondary)
                        }.padding(22).background(.background, in: RoundedRectangle(cornerRadius: 18))
                    }.buttonStyle(.plain)
                }
            }.padding(28)
        }.background(TeachingColors.background)
        .refreshable { await model.loadSessions() }
        .onChange(of: model.selectedDate) { _, _ in Task { await model.loadSessions() } }
    }
}

struct LessonWorkspace: View {
    @ObservedObject var model: TeachingModel
    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                GlassEffectContainer(spacing: 8) {
                    HStack(spacing: 8) {
                        ForEach(model.lesson?.resources ?? []) { item in
                            tab(item)
                        }
                    }.padding(.horizontal, 16).padding(.vertical, 8)
                }
            }
            if let item = model.activeResource, let store = model.store, let session = model.session {
                PDFWorkspace(model: model, resource: item, sessionID: session.id, store: store)
            }
        }.background(TeachingColors.background)
    }
    private func tab(_ item: LessonResource) -> some View {
        Menu {
            LessonResourceActions(model: model, item: item)
        } label: {
            Label(item.resource.worksheet.title, systemImage: "doc").font(.subheadline.weight(.semibold))
                .lineLimit(1).padding(.horizontal, 16).padding(.vertical, 12)
        } primaryAction: { model.open(item) }
            .buttonStyle(.plain)
            .foregroundStyle(model.activeResourceID == item.id ? .white : TeachingColors.navy)
            .glassEffect(.regular.tint(model.activeResourceID == item.id ? TeachingColors.navy : .clear).interactive(), in: .capsule)
            .accessibilityAddTraits(model.activeResourceID == item.id ? .isSelected : [])
    }
}

struct PDFWorkspace: View {
    @ObservedObject var model: TeachingModel
    let resource: LessonResource
    let sessionID: UUID
    let store: LessonStore
    @State private var ratio = 0.55
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        GeometryReader { geometry in
            let split = model.solutions && resource.solutions != nil
            let available = max(1, geometry.size.width - 24)
            ZStack(alignment: .trailing) {
                DocumentPane(model: model, document: resource.worksheet, sessionID: sessionID, store: store, worksheet: true)
                    .id(resource.worksheet.id).frame(width: split ? available * ratio : geometry.size.width)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if split, let answer = resource.solutions {
                    HStack(spacing: 0) {
                        ZStack {
                            Color(uiColor: .secondarySystemBackground)
                            Capsule().fill(.secondary.opacity(0.4)).frame(width: 5, height: 56)
                        }.frame(width: 24).contentShape(Rectangle())
                            .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .named("lesson-documents"))
                                .onChanged { value in ratio = min(0.75, max(0.25, (value.location.x - 12) / available)) })
                            .accessibilityLabel("Solutions divider").accessibilityValue("\(Int(ratio * 100))% worksheet")
                            .accessibilityAdjustableAction { direction in
                                ratio = min(0.75, max(0.25, ratio + (direction == .increment ? 0.05 : -0.05)))
                            }
                        DocumentPane(model: model, document: answer, sessionID: sessionID, store: store, worksheet: false)
                            .id(answer.id).frame(width: available * (1 - ratio))
                    }.frame(width: 24 + available * (1 - ratio))
                        .transition(reduceMotion ? .opacity : .move(edge: .trailing))
                }
            }.coordinateSpace(name: "lesson-documents").clipped()
                .animation(TeachingMotion.panel(reduceMotion: reduceMotion), value: model.solutions)
                .overlay(alignment: .topTrailing) {
                    if resource.solutions != nil {
                        Button { model.solutions.toggle() } label: {
                            Label(model.solutions ? "Hide solutions" : "Show solutions", systemImage: "rectangle.righthalf.inset.filled")
                                .font(.subheadline.weight(.semibold)).padding(.horizontal, 16).padding(.vertical, 11)
                                .background(.regularMaterial, in: Capsule()).shadow(color: .black.opacity(0.12), radius: 8, y: 2)
                        }.buttonStyle(.plain).padding(14).accessibilityIdentifier("teaching-solutions")
                    }
                }
                .overlay(alignment: .bottomLeading) {
                    Toggle(isOn: $model.fingerDrawing) { Label("Finger ink", systemImage: "hand.draw") }
                        .toggleStyle(.button).font(.caption).padding(10).background(.regularMaterial, in: Capsule()).padding(14)
                }
        }
    }
}

struct DocumentPane: View {
    @ObservedObject var model: TeachingModel
    let document: CachedDocument
    let sessionID: UUID
    let store: LessonStore
    let worksheet: Bool
    var body: some View {
        Group {
            if let external = document.source.externalURL {
                ContentUnavailableView { Label("External resource", systemImage: "link") } description: { Text(document.source.title) } actions: { Link("Open resource", destination: external).buttonStyle(.borderedProminent) }
            } else if document.source.isPDF {
                PDFDocumentSurface(document: document, sessionID: sessionID, store: store, isWorksheet: worksheet,
                    fingerDrawing: model.fingerDrawing, onError: model.report)
            } else if let url = try? store.documentURL(sessionID: sessionID, document: document), let image = UIImage(contentsOfFile: url.path) {
                Image(uiImage: image).resizable().scaledToFit().padding()
            } else { ContentUnavailableView("Resource downloaded", systemImage: "doc", description: Text("Share this file from its lesson card to open it in a compatible app.")) }
        }
    }
}

struct NativeShareSheet: UIViewControllerRepresentable {
    let url: URL
    let onComplete: () -> Void
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        controller.completionWithItemsHandler = { _, _, _, _ in Task { @MainActor in onComplete() } }
        return controller
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
