import SwiftUI
import TeachingCore


struct TeachingNavigation: View {
    @ObservedObject var model: TeachingModel
    @State private var library = false
    @State private var log = false
    @State private var classroom = false
    @State private var signingOut = false
    var body: some View {
        NavigationStack {
            Group {
                if model.session != nil {
                    LessonWorkspace(model: model)
                } else {
                    SessionDayView(model: model)
                }
            }
            .navigationTitle(model.session?.title ?? "Your teaching day")
            .navigationBarTitleDisplayMode(model.session == nil ? .large : .inline)
            .toolbar {
                if let session = model.session {
                    ToolbarItem(placement: .topBarLeading) { Button { library = false; model.leaveLesson() } label: { Label("Today", systemImage: "chevron.left") } }
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        Button { classroom = true } label: { Label("Classroom display", systemImage: "airplay.video") }
                        Button { model.showLessonInformation(); log = true } label: { Label(session.logged ? "View log" : "Review log", systemImage: "checklist") }.keyboardShortcut("l", modifiers: .command).accessibilityIdentifier("teaching-log")
                    }
                    ToolbarSpacer(.fixed, placement: .topBarTrailing)
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { withAnimation(.easeInOut(duration: 0.22)) { library.toggle() } } label: { Label("Resources", systemImage: "sidebar.right") }.accessibilityIdentifier("teaching-library")
                    }
                } else {
                    ToolbarItem(placement: .topBarTrailing) { Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right") { signingOut = true } }
                }
            }
            .overlay {
                if library, model.session != nil {
                    GeometryReader { geometry in
                        ZStack(alignment: .trailing) {
                            Color.black.opacity(0.12).contentShape(Rectangle())
                                .onTapGesture { withAnimation(.easeInOut(duration: 0.22)) { library = false } }
                                .accessibilityLabel("Dismiss resource library").accessibilityAddTraits(.isButton)
                            ResourceLibrary(model: model) { withAnimation(.easeInOut(duration: 0.22)) { library = false } }
                                .frame(width: min(460, geometry.size.width - 44)).frame(maxHeight: .infinity)
                                .background(.regularMaterial).shadow(color: .black.opacity(0.16), radius: 24, x: -8)
                                .transition(.move(edge: .trailing))
                        }
                    }
                }
            }
            .overlay(alignment: .bottom) {
                if model.busy { ProgressView("Working…").padding(12).background(.regularMaterial, in: Capsule()).padding() }
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                if model.offline { Label("Cached lessons · reconnect to search, add resources or submit a log", systemImage: "wifi.slash").font(.footnote).padding(9).frame(maxWidth: .infinity).background(.yellow.opacity(0.15)) }
            }
            .sheet(isPresented: $log, onDismiss: { model.allowActiveWorksheet() }) { if let session = model.session { TutorLogView(model: model, session: session) } }
            .sheet(isPresented: $classroom) { NavigationStack { ClassroomView().navigationTitle("Classroom display preview").toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { classroom = false } } } } }
            .sheet(isPresented: Binding(get: { model.sharedURL != nil }, set: { if !$0 { model.finishSharing() } })) {
                if let url = model.sharedURL { NativeShareSheet(url: url) { model.finishSharing() } }
            }
            .confirmationDialog("Sign out of this teaching iPad?", isPresented: $signingOut) { Button("Sign out", role: .destructive) { model.signOut() } }
            message: { Text("Your local lesson annotations stay on this iPad for your next sign-in.") }
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
                HStack(spacing: 6) {
                    tab("Lesson board", systemImage: "square.grid.2x2", selected: !model.viewer) { model.showBoard() }
                    ForEach(model.lesson?.resources ?? []) { item in
                        tab(item.resource.worksheet.title, systemImage: "doc", selected: model.viewer && model.activeResourceID == item.id) { model.open(item) }
                    }
                }.padding(.horizontal, 16).padding(.vertical, 8)
            }.background(.regularMaterial)
            if model.viewer, let item = model.activeResource, let store = model.store, let session = model.session {
                PDFWorkspace(model: model, resource: item, sessionID: session.id, store: store)
            } else { LessonBoard(model: model) }
        }.background(TeachingColors.background)
    }
    private func tab(_ title: String, systemImage: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage).font(.subheadline.weight(.semibold)).lineLimit(1)
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(selected ? TeachingColors.navy : .clear, in: RoundedRectangle(cornerRadius: 10))
                .foregroundStyle(selected ? .white : TeachingColors.navy)
        }.buttonStyle(.plain).accessibilityAddTraits(selected ? .isSelected : [])
    }
}

struct LessonBoard: View {
    @ObservedObject var model: TeachingModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("This lesson").font(.largeTitle.bold())
                Text("Add resources from the library, then open one to teach. Your worksheets and private solutions keep their own ink and positions.").foregroundStyle(.secondary)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 18)], spacing: 18) {
                    ForEach(model.lesson?.resources ?? []) { item in
                        Button { model.open(item) } label: {
                            VStack(alignment: .leading, spacing: 14) {
                                Image(systemName: item.resource.worksheet.isPDF ? "doc.richtext" : "doc").font(.system(size: 44)).foregroundStyle(TeachingColors.teal).frame(height: 100).frame(maxWidth: .infinity).background(TeachingColors.background, in: RoundedRectangle(cornerRadius: 12))
                                Text(item.resource.worksheet.title).font(.headline).lineLimit(3)
                                Text(item.resource.topicName).font(.subheadline).foregroundStyle(.secondary)
                                Label("Open resource", systemImage: "arrow.up.right").font(.subheadline.bold()).foregroundStyle(TeachingColors.teal)
                            }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 18))
                        }.buttonStyle(.plain).contextMenu {
                            Button("Download a fresh copy", systemImage: "arrow.down.doc") { Task { await model.add(item.resource, freshCopy: true) } }.disabled(model.offline)
                            Button("Share worksheet", systemImage: "square.and.arrow.up") { model.share(item.worksheet) }
                            if let solutions = item.solutions { Button("Share solutions", systemImage: "square.and.arrow.up") { model.share(solutions) } }
                        }
                    }
                }
                if model.lesson?.resources.isEmpty != false {
                    ContentUnavailableView("Your lesson starts here", systemImage: "doc.badge.plus", description: Text("Open Resources to browse and preview files, then choose Add to lesson."))
                }
            }.padding(28)
        }
    }
}

struct PDFWorkspace: View {
    @ObservedObject var model: TeachingModel
    let resource: LessonResource
    let sessionID: UUID
    let store: LessonStore
    @State private var ratio = 0.55
    var body: some View {
        GeometryReader { geometry in
            let split = model.solutions && resource.solutions != nil
            let available = max(1, geometry.size.width - 24)
            HStack(spacing: 0) {
                DocumentPane(model: model, document: resource.worksheet, sessionID: sessionID, store: store, worksheet: true)
                    .id(resource.worksheet.id).frame(width: split ? available * ratio : geometry.size.width)
                if split, let answer = resource.solutions {
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
                }
            }.coordinateSpace(name: "lesson-documents")
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
