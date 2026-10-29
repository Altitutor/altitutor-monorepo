import SwiftUI
import TeachingCore
import QuickLook

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
                    HStack(spacing: 0) {
                        if library { ResourceLibrary(model: model).frame(width: 285).background(.regularMaterial) }
                        LessonWorkspace(model: model)
                    }
                    .dropDestination(for: String.self) { ids, _ in
                        guard let id = ids.first.flatMap(UUID.init(uuidString:)), let resource = model.catalog.first(where: { $0.id == id }) else { return false }
                        Task { await model.add(resource) }; return true
                    }
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
                        Button { withAnimation { library.toggle() } } label: { Label("Resources", systemImage: "sidebar.left") }.accessibilityIdentifier("teaching-library")
                        Button { classroom = true } label: { Label("Classroom display", systemImage: "airplay.video") }
                        Button { model.showLessonInformation(); log = true } label: { Label(session.logged ? "View log" : "Review log", systemImage: "checklist") }.accessibilityIdentifier("teaching-log")
                    }
                } else {
                    ToolbarItem(placement: .topBarTrailing) { Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right") { signingOut = true } }
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

struct ResourceLibrary: View {
    @ObservedObject var model: TeachingModel
    @State private var query = ""
    @State private var allSubjects = false
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Resource library").font(.headline)
            TextField("Search file names", text: $query).textFieldStyle(.roundedBorder).accessibilityIdentifier("resource-search")
            if model.session?.subjectID != nil { Toggle("Search all subjects", isOn: $allSubjects).font(.subheadline) }
            else { Text("All accessible subjects").font(.caption).foregroundStyle(.secondary) }
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(model.catalog) { resource in
                        VStack(alignment: .leading, spacing: 10) {
                            Label(resource.worksheet.title, systemImage: resource.worksheet.isPDF ? "doc.richtext" : "doc").font(.subheadline.bold())
                            Text(resource.subjectName + " · " + resource.topicName).font(.caption).foregroundStyle(.secondary)
                            Button(model.lesson?.resources.contains(where: { $0.resource.id == resource.id }) == true ? "Added to lesson" : "Add to lesson") { Task { await model.add(resource) } }.buttonStyle(.bordered).disabled(model.busy || model.offline)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(15).background(.background, in: RoundedRectangle(cornerRadius: 14))
                            .draggable(resource.id.uuidString)
                    }
                    if model.libraryBusy { ProgressView() }
                    if model.catalog.isEmpty && !model.libraryBusy { Text("No matching resources.").foregroundStyle(.secondary).padding() }
                    if model.nextOffset != nil { Button("More resources") { Task { await model.search(query, allSubjects: allSubjects, more: true) } }.disabled(model.libraryBusy) }
                }
            }
        }.padding(16)
        .task(id: query + String(allSubjects)) {
            do { try await Task.sleep(for: .milliseconds(250)); await model.search(query, allSubjects: allSubjects) } catch {}
        }
    }
}

struct LessonWorkspace: View {
    @ObservedObject var model: TeachingModel
    var body: some View {
        Group {
            if model.viewer, let item = model.activeResource, let store = model.store, let session = model.session {
                HStack(spacing: 0) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 10) {
                            Button { model.showBoard() } label: { Label("Lesson board", systemImage: "square.grid.2x2") }.padding(.bottom, 8)
                            ForEach(model.lesson?.resources ?? []) { resource in
                                Button { model.open(resource) } label: {
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(resource.resource.worksheet.title).font(.subheadline.bold()).lineLimit(3)
                                        Text(resource.resource.topicName).font(.caption).lineLimit(2)
                                    }.frame(maxWidth: .infinity, alignment: .leading).padding(13)
                                        .background(model.activeResourceID == resource.id ? TeachingColors.navy : Color(uiColor: .tertiarySystemFill), in: RoundedRectangle(cornerRadius: 12))
                                        .foregroundStyle(model.activeResourceID == resource.id ? Color.white : Color.primary)
                                }.buttonStyle(.plain)
                            }
                        }.padding(12)
                    }.frame(width: 190).background(.regularMaterial)
                    VStack(spacing: 0) {
                        HStack {
                            Toggle("Finger ink", isOn: $model.fingerDrawing).toggleStyle(.button).font(.caption)
                            Spacer()
                            if item.solutions != nil { Button(model.solutions ? "Hide solutions" : "Show solutions") { withAnimation { model.solutions.toggle() } }.accessibilityIdentifier("teaching-solutions") }
                        }.padding(10)
                        PDFWorkspace(model: model, resource: item, sessionID: session.id, store: store)
                    }
                }
            } else { LessonBoard(model: model) }
        }.background(TeachingColors.background)
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
                    ContentUnavailableView("Your lesson starts here", systemImage: "doc.badge.plus", description: Text("Open Resources to find a worksheet. Drag it into the workspace or tap Add to lesson."))
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
    @State private var dragStart: Double?
    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                DocumentPane(model: model, document: resource.worksheet, sessionID: sessionID, store: store, worksheet: true)
                    .id(resource.worksheet.id).frame(width: model.solutions && resource.solutions != nil ? max(180, (geometry.size.width - 12) * ratio) : geometry.size.width)
                if model.solutions, let answer = resource.solutions {
                    RoundedRectangle(cornerRadius: 3).fill(.secondary.opacity(0.3)).frame(width: 6, height: 60).frame(width: 12, height: geometry.size.height)
                        .contentShape(Rectangle()).gesture(DragGesture().onChanged { value in if dragStart == nil { dragStart = ratio }; ratio = min(0.72, max(0.28, (dragStart ?? ratio) + value.translation.width / max(geometry.size.width, 1))) }.onEnded { _ in dragStart = nil })
                        .accessibilityLabel("Solutions divider")
                    DocumentPane(model: model, document: answer, sessionID: sessionID, store: store, worksheet: false).id(answer.id)
                        .transition(.move(edge: .trailing))
                }
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
    @StateObject private var controls = PDFPaneControls()
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text(worksheet ? "Worksheet" : "Private solutions").font(.caption.bold()).lineLimit(1)
                Spacer(minLength: 0)
                if document.source.isPDF {
                    Button { controls.move(-1) } label: { Image(systemName: "chevron.left") }.accessibilityLabel("Previous page")
                    Text("\(controls.page)/\(controls.count)").font(.caption.monospacedDigit())
                    Button { controls.move(1) } label: { Image(systemName: "chevron.right") }.accessibilityLabel("Next page")
                    Menu {
                        Button("Fit page") { controls.fit() }
                        Button("Rotate 90°") { controls.rotate() }
                        Button(worksheet ? "Share worksheet" : "Share solutions") { model.share(document) }
                    } label: { Image(systemName: "ellipsis.circle") }.accessibilityLabel("PDF actions")
                } else { Button { model.share(document) } label: { Image(systemName: "square.and.arrow.up") } }
            }.buttonStyle(.borderless).padding(12).background(.regularMaterial)
            if let external = document.source.externalURL {
                ContentUnavailableView { Label("External resource", systemImage: "link") } description: { Text(document.source.title) } actions: { Link("Open resource", destination: external).buttonStyle(.borderedProminent) }
            } else if document.source.isPDF {
                PDFDocumentSurface(document: document, sessionID: sessionID, store: store, isWorksheet: worksheet,
                    fingerDrawing: model.fingerDrawing, controls: controls, onError: model.report)
            } else if let url = try? store.documentURL(sessionID: sessionID, document: document), let image = UIImage(contentsOfFile: url.path) {
                Image(uiImage: image).resizable().scaledToFit().padding()
            } else { ContentUnavailableView("Resource downloaded", systemImage: "doc", description: Text("Use Share to open this file in a compatible app.")) }
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
