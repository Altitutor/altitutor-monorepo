import SwiftUI
import TeachingCore
import UniformTypeIdentifiers


enum TeachingMotion {
    static func panel(reduceMotion: Bool) -> Animation {
        reduceMotion ? .easeOut(duration: 0.15) : .spring(response: 0.32, dampingFraction: 1)
    }
    static func folder(reduceMotion: Bool) -> Animation {
        reduceMotion ? .easeOut(duration: 0.12) : .snappy(duration: 0.18, extraBounce: 0)
    }
}

struct TeachingNavigation: View {
    @ObservedObject var model: TeachingModel
    @State private var library = false
    @State private var log = false
    @State private var importing = false
    @State private var preview: TeachingResource?
    @State private var previousPreview: PreviousLessonPDF?
    @State private var settings = false
    @State private var bulkPrinting = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        NavigationStack(path: $model.route) {
            SessionDayView(model: model)
                .navigationTitle("Your teaching day").navigationBarTitleDisplayMode(.large)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Menu", systemImage: "line.3.horizontal") { settings = true }
                            .accessibilityIdentifier("teaching-menu")
                    }
                }
                .navigationDestination(for: TeachingRoute.self) { route in
                    Group {
                        switch route {
                        case .lesson:
                            surface {
                                LessonBoard(model: model, addResource: { library = true }, previewPrevious: {
                                    model.showLessonInformation()
                                    previousPreview = $0
                                })
                            }
                        case .document: surface { LessonWorkspace(model: model) }
                        }
                    }.navigationTitle(model.session?.title ?? "Lesson").navigationBarTitleDisplayMode(.inline)
                        .toolbar { lessonControls }
                        .onDisappear { if case .lesson = route, model.route.isEmpty { model.leaveLesson() } }
                }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf], allowsMultipleSelection: true) { result in
            switch result {
            case .success(let urls): model.importDocuments(urls)
            case .failure(let error): model.report(error)
            }
        }
        .onChange(of: model.route) { _, _ in library = false; model.navigationChanged() }
        .sheet(isPresented: $bulkPrinting, onDismiss: { model.allowActiveWorksheet() }) {
            if let sessionID = model.selectedSessionID {
                BulkOfficePrintView(model: model, sessionID: sessionID)
            }
        }
        .sheet(item: $model.printRequest, onDismiss: { model.allowActiveWorksheet() }) { request in
            OfficePrintView(model: model, request: request)
        }
        .overlay(alignment: .bottom) {
            if let notice = model.printNotice {
                HStack(spacing: 12) {
                    Label(notice, systemImage: "printer").font(.subheadline)
                    Spacer()
                    Button("Dismiss", systemImage: "xmark") { model.printNotice = nil }.labelStyle(.iconOnly)
                }.padding(16).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18)).padding(16)
            }
        }
        .sheet(isPresented: $log, onDismiss: { model.allowActiveWorksheet() }) {
            if let session = model.session { TutorLogView(model: model, session: session) }
        }
        .sheet(item: $previousPreview, onDismiss: { model.allowActiveWorksheet() }) { previous in
            PreviousLessonPreview(model: model, previous: previous)
        }
        .sheet(item: $preview, onDismiss: { model.allowActiveWorksheet() }) { resource in
            LibraryPreview(model: model, resource: resource) { preview = nil }
        }
        .sheet(isPresented: Binding(get: { model.sharedURL != nil }, set: { if !$0 { model.finishSharing() } })) {
            if let url = model.sharedURL { NativeShareSheet(url: url) { model.finishSharing() } }
        }
        .sheet(isPresented: $settings) {
            TeachingSettings(model: model) {
                settings = false
                model.signOut()
            }
        }
    }
    @ToolbarContentBuilder private var lessonControls: some ToolbarContent {
        if let session = model.session {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if model.viewer, let item = model.activeResource {
                    if item.worksheet.source.isPDF || (model.solutions && item.solutions?.source.isPDF == true) {
                        Button {
                            model.laserMode = model.laserMode.next
                        } label: {
                            Label("Laser pointer", systemImage: model.laserMode.symbol)
                        }.tint(model.laserMode == .off ? nil : .red)
                            .accessibilityValue(model.laserMode.label)
                            .accessibilityHint(model.laserMode.hint)
                            .accessibilityAddTraits(model.laserMode == .off ? [] : .isSelected)
                            .accessibilityIdentifier("teaching-laser")
                    }
                    Button { library = false; model.presentPrint(item.worksheet) } label: { Label("Print to office", systemImage: "printer") }
                        .disabled(model.offline || item.worksheet.source.externalURL != nil || !item.worksheet.source.isPDF)
                }
                if model.viewer, let item = model.activeResource {
                    Button { library = false; model.share(item.worksheet) } label: { Label("Share worksheet", systemImage: "square.and.arrow.up") }
                }
                if !model.viewer {
                    Button {
                        library = false; model.showLessonInformation(); bulkPrinting = true
                    } label: { Label("Bulk print", systemImage: "printer.filled.and.paper") }
                        .disabled(model.offline || model.lesson?.resources.isEmpty != false)
                        .accessibilityIdentifier("teaching-bulk-print")
                    Button { library = false; model.showLessonInformation(); importing = true } label: { Label("Import PDF", systemImage: "square.and.arrow.down") }
                        .disabled(model.busy).accessibilityIdentifier("teaching-import")
                }
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

private struct TeachingSettings: View {
    @ObservedObject var model: TeachingModel
    @Environment(\.dismiss) private var dismiss
    @AppStorage("teaching-theme") private var theme = TeachingTheme.light
    @State private var confirmingLogout = false
    @State private var syncingForLogout = false
    @State private var syncFailure = false
    let logOut: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Picker("Theme", selection: $theme) {
                    ForEach(TeachingTheme.allCases) { option in
                        Text(option.rawValue.capitalized).tag(option)
                    }
                }
                if let staff = model.staffDirectory.first(where: { $0.id == model.profile?.id }) {
                    NavigationLink("Teaching PIN") { TeachingPINSettings(api: model.api, staff: staff) }
                }
                Button(syncingForLogout ? "Syncing documents…" : "Log out", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) {
                    confirmingLogout = true
                }
                if syncFailure {
                    Text("Some documents still need to sync. Retry or log out now to keep them queued on this iPad.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .confirmationDialog("Log out of this teaching iPad?", isPresented: $confirmingLogout) {
                if model.hasPendingWorkspaceSync && !model.offline && !syncingForLogout {
                    Button("Sync and log out") {
                        Task {
                            syncingForLogout = true; syncFailure = false
                            let synced = await model.syncBeforeLogout()
                            syncingForLogout = false
                            if synced { logOut() }
                            else if model.profile != nil { syncFailure = true }
                        }
                    }
                }
                Button(model.hasPendingWorkspaceSync ? "Log out now" : "Log out", role: .destructive, action: logOut)
            } message: {
                if model.hasPendingWorkspaceSync {
                    Text("Some PDFs are still syncing. If you log out now, this iPad will retry when you next sign in here.")
                } else {
                    Text("Your local lesson annotations stay on this iPad for your next sign-in.")
                }
            }
        }
        .preferredColorScheme(theme.colorScheme)
    }
}

private struct TeachingPINSettings: View {
    let api: TeachingAPI
    let staff: StaffLogin
    @State private var pin = ""
    @State private var password = ""
    @State private var saving = false
    @State private var feedback: String?
    @State private var enrolled = false

    var body: some View {
        Form {
            Section {
                SecureField("New 4-digit PIN", text: $pin).keyboardType(.numberPad)
                    .onChange(of: pin) { _, value in
                        pin = String(decoding: value.utf8.filter { (48...57).contains($0) }.prefix(4), as: UTF8.self)
                    }
                SecureField("Account password", text: $password)
                Button("Save PIN") { Task { await savePIN() } }
                    .disabled(pin.utf8.count != 4 || password.isEmpty)
            } footer: {
                Text("This PIN works on this iPad for 30 days. Use your account password on TutorWeb and to set up another iPad.")
            }
            if enrolled {
                Button("Remove PIN", role: .destructive) {
                    do { try api.removePIN(for: staff.id); enrolled = false; feedback = "PIN removed from this iPad." }
                    catch { feedback = error.localizedDescription }
                }
            }
            if let feedback { Text(feedback).accessibilityAddTraits(.updatesFrequently) }
        }
        .disabled(saving)
        .navigationTitle("Teaching PIN")
        .onAppear { enrolled = api.hasPIN(for: staff.id) }
    }

    private func savePIN() async {
        saving = true
        defer { saving = false; password = ""; pin = "" }
        do {
            try await api.setPIN(pin, password: password, staff: staff)
            enrolled = true
            feedback = "PIN saved for this iPad."
        } catch { feedback = error.localizedDescription }
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
                }
                if model.sessions.isEmpty && !model.busy {
                    ContentUnavailableView("No sessions on this date", systemImage: "calendar", description: Text(model.offline ? "No cached sessions for this date. Reconnect to load your timetable." : "Choose another date or pull down to refresh."))
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
    @State private var dragging: UUID?
    @State private var solutionsWidth: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        ZStack(alignment: .top) {
            if let item = model.activeResource, let store = model.store, let session = model.session {
                PDFWorkspace(model: model, resource: item, sessionID: session.id, store: store)
            }
            ZStack(alignment: .trailing) {
                ScrollViewReader { reader in
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(model.lesson?.resources ?? []) { item in tab(item).id(item.id) }
                        }.padding(.leading, 16).padding(.vertical, 8)
                    }
                    .scrollEdgeEffectHidden()
                    .contentMargins(.trailing, solutionsWidth + 24, for: .scrollContent)
                    .onDrop(of: [LessonReorder.type], delegate: LessonReorder(model: model, target: nil,
                        animation: TeachingMotion.panel(reduceMotion: reduceMotion), dragging: $dragging))
                    .onAppear { if let id = model.activeResourceID { reader.scrollTo(id, anchor: .trailing) } }
                    .onChange(of: model.activeResourceID) { _, id in if let id { reader.scrollTo(id, anchor: .trailing) } }
                }
                Group {
                    if model.activeResource?.solutions == nil {
                        Label("Solutions not available", systemImage: "rectangle.righthalf.inset.filled")
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 12).padding(.vertical, 8).glassEffect(.regular, in: .capsule)
                    } else {
                        Button { model.solutions.toggle() } label: {
                            Label(model.solutions ? "Hide solutions" : "Show solutions", systemImage: "rectangle.righthalf.inset.filled")
                                .padding(.horizontal, 12).padding(.vertical, 8)
                        }.buttonStyle(.glass)
                    }
                }.font(.subheadline.weight(.semibold)).fixedSize()
                    .onGeometryChange(for: CGFloat.self, of: { $0.size.width }) { solutionsWidth = $0 }
                    .padding(.trailing, 16)
                    .accessibilityIdentifier("teaching-solutions")
            }.frame(height: 60)
        }.scrollEdgeEffectHidden(true, for: .top).background(TeachingColors.background)
            .onDisappear { dragging = nil }
    }
    private func tab(_ item: LessonResource) -> some View {
        Menu {
            LessonResourceActions(model: model, item: item)
        } label: {
            Label(model.title(item.worksheet.source), systemImage: "doc").font(.subheadline.weight(.semibold))
                .lineLimit(1).padding(.horizontal, 16).padding(.vertical, 12)
        } primaryAction: { model.open(item) }
            .buttonStyle(.plain)
            .foregroundStyle(.primary)
            .background {
                Capsule().fill(Color(uiColor: .secondarySystemBackground))
                    .overlay {
                        Capsule().fill(TeachingColors.teal.opacity(model.activeResourceID == item.id ? 0.20 : 0))
                    }
            }
            .overlay { Capsule().strokeBorder(.primary.opacity(model.activeResourceID == item.id ? 0.45 : 0), lineWidth: 1) }
            .accessibilityAddTraits(model.activeResourceID == item.id ? .isSelected : [])
            .modifier(LessonResourceDrag(model: model, item: item, dragging: $dragging))
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
        }
    }
}

struct DocumentPane: View {
    @ObservedObject var model: TeachingModel
    let document: CachedDocument
    let sessionID: UUID
    let store: LessonStore
    let worksheet: Bool
    @State private var solutionsSidebar = false
    var body: some View {
        Group {
            if let external = document.source.externalURL {
                ContentUnavailableView { Label("External resource", systemImage: "link") } description: { Text(document.source.title) } actions: { Link("Open resource", destination: external).buttonStyle(.borderedProminent) }
            } else if document.source.isPDF {
                PDFEditorView(document: document, sessionID: sessionID, store: store, isWorksheet: worksheet,
                    laserMode: model.laserMode, sidebar: worksheet ? $model.pageSidebar : $solutionsSidebar,
                    onEdit: { model.documentRevision = UUID() }, onError: model.report)
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
