import SwiftUI

@main struct AltitutorTeachingApp: App {
    @UIApplicationDelegateAdaptor(TeachingAppDelegate.self) var delegate
    @StateObject private var model = TeachingModel()
    var body: some Scene { WindowGroup { TeachingRootView(model: model) } }
}

@MainActor final class TeachingAppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(name: nil, sessionRole: session.role)
        if session.role == .windowExternalDisplayNonInteractive { configuration.delegateClass = ClassroomSceneDelegate.self }
        return configuration
    }
}

struct TeachingRootView: View {
    @ObservedObject var model: TeachingModel
    var body: some View {
        Group {
            if model.profile == nil { SignInView(model: model) }
            else { TeachingNavigation(model: model) }
        }
        .tint(TeachingColors.navy)
        .task { await model.start() }
        .alert("Teaching", isPresented: Binding(get: { model.error != nil }, set: { if !$0 { model.error = nil } })) {
            Button("OK") { model.error = nil }
        } message: { Text(model.error ?? "") }
    }
}

struct SignInView: View {
    @ObservedObject var model: TeachingModel
    @State private var email = ""
    @State private var password = ""
    @State private var staffID: UUID?
    @State private var setup = false
    @FocusState private var passwordFocused: Bool
    private var needsSetup: Bool { setup || model.staffDirectory.isEmpty }
    private var selectedEmail: String {
        needsSetup ? email : model.staffDirectory.first { $0.id == staffID }?.email ?? ""
    }
    private var canSignIn: Bool { !model.busy && !selectedEmail.isEmpty && !password.isEmpty }

    var body: some View {
        VStack(spacing: 24) {
            Text("Altitutor Teaching").font(.system(size: 34, weight: .bold))
                .foregroundStyle(TeachingColors.navy).multilineTextAlignment(.center)
            VStack(spacing: 16) {
                Group {
                    if needsSetup {
                        HStack(spacing: 12) {
                            Image(systemName: "person").foregroundStyle(.secondary).accessibilityHidden(true)
                            TextField("Staff email", text: $email).textContentType(.username).keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never).autocorrectionDisabled()
                                .submitLabel(.next).onSubmit { passwordFocused = true }
                                .accessibilityIdentifier("teaching-email")
                        }
                    } else {
                        Menu {
                            ForEach(model.staffDirectory) { staff in
                                Button(staff.name) { staffID = staff.id; password = ""; passwordFocused = true }
                            }
                        } label: {
                            HStack {
                                Image(systemName: "person").foregroundStyle(.secondary)
                                Text(model.staffDirectory.first { $0.id == staffID }?.name ?? "Select your name")
                                Spacer()
                                Image(systemName: "chevron.up.chevron.down").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                            }.contentShape(Rectangle())
                        }.buttonStyle(.plain).accessibilityIdentifier("teaching-staff")
                    }
                }.padding(16).glassEffect(.regular, in: .rect(cornerRadius: 16))
                HStack(spacing: 12) {
                    Image(systemName: "lock").foregroundStyle(.secondary).accessibilityHidden(true)
                    SecureField("Password", text: $password).textContentType(.password)
                        .focused($passwordFocused).submitLabel(.go).onSubmit { signIn() }
                        .accessibilityIdentifier("teaching-password")
                }.padding(16).glassEffect(.regular, in: .rect(cornerRadius: 16))
            }.textFieldStyle(.plain)
            Button(action: signIn) {
                HStack {
                    if model.busy { ProgressView().tint(.white) }
                    Text(needsSetup ? "Sign in and set up iPad" : "Sign in").frame(maxWidth: .infinity)
                }
            }.buttonStyle(.glassProminent).controlSize(.large).disabled(!canSignIn)
                .accessibilityIdentifier("teaching-sign-in")
            if !model.staffDirectory.isEmpty {
                Button(needsSetup ? "Back to staff list" : "Update staff list") {
                    setup.toggle(); password = ""; email = ""; passwordFocused = false
                }.font(.subheadline).disabled(model.busy)
            }
        }.padding(36).frame(maxWidth: 470).frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(TeachingColors.background)
            .onDisappear { password = "" }
    }
    private func signIn() {
        guard canSignIn else { return }
        let loginEmail = selectedEmail, loginPassword = password
        passwordFocused = false
        Task {
            await model.signIn(email: loginEmail, password: loginPassword)
            password = ""
        }
    }
}

enum TeachingColors {
    static let navy = Color(red: 0.02, green: 0.14, blue: 0.26)
    static let teal = Color(red: 0.25, green: 0.46, blue: 0.59)
    static let background = Color(uiColor: .systemGroupedBackground)
}
