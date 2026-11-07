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
    @AppStorage("teaching-theme") private var theme = TeachingTheme.light
    var body: some View {
        Group {
            if model.profile == nil { SignInView(model: model) }
            else { TeachingNavigation(model: model) }
        }
        .preferredColorScheme(theme.colorScheme)
        .tint(TeachingColors.accent)
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
    @State private var usePassword = false
    @FocusState private var passwordFocused: Bool
    private var needsSetup: Bool { setup || model.staffDirectory.isEmpty }
    private var selectedEmail: String {
        needsSetup ? email : model.staffDirectory.first { $0.id == staffID }?.email ?? ""
    }
    private var hasPIN: Bool { !needsSetup && staffID.map { model.api.hasPIN(for: $0) } == true }
    private var pinSignIn: Bool { hasPIN && !usePassword }
    private var canSignIn: Bool {
        !model.busy && !selectedEmail.isEmpty && (pinSignIn ? password.utf8.count == 4 : !password.isEmpty)
    }

    var body: some View {
        VStack(spacing: 24) {
            Text("Altitutor Teaching").font(.system(size: 34, weight: .bold))
                .foregroundStyle(TeachingColors.accent).multilineTextAlignment(.center)
            VStack(spacing: 16) {
                Group {
                    if needsSetup {
                        HStack(spacing: 12) {
                            Image(systemName: "person").foregroundStyle(.secondary).accessibilityHidden(true)
                            TextField("Staff email", text: $email).keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never).autocorrectionDisabled()
                                .submitLabel(.next).onSubmit { passwordFocused = true }
                                .accessibilityIdentifier("teaching-email")
                        }
                    } else {
                        Menu {
                            ForEach(model.staffDirectory) { staff in
                                Button(staff.name) { staffID = staff.id; password = ""; usePassword = false; passwordFocused = true }
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
                    SecureField(pinSignIn ? "4-digit PIN" : "Password", text: $password)
                        .keyboardType(pinSignIn ? .numberPad : .default)
                        .focused($passwordFocused).submitLabel(.go).onSubmit { signIn() }
                        .accessibilityIdentifier(pinSignIn ? "teaching-pin" : "teaching-password")
                        .onChange(of: password) { _, value in
                            if pinSignIn { password = String(decoding: value.utf8.filter { (48...57).contains($0) }.prefix(4), as: UTF8.self) }
                        }
                }.padding(16).glassEffect(.regular, in: .rect(cornerRadius: 16))
            }.textFieldStyle(.plain)
            Button(action: signIn) {
                HStack {
                    if model.busy { ProgressView().tint(.white) }
                    Text(needsSetup ? "Sign in and set up iPad" : "Sign in").frame(maxWidth: .infinity)
                }
            }.buttonStyle(.glassProminent).controlSize(.large).disabled(!canSignIn)
                .accessibilityIdentifier("teaching-sign-in")
            if hasPIN {
                Button(pinSignIn ? "Use password" : "Use PIN") {
                    usePassword.toggle(); password = ""; passwordFocused = true
                }.font(.subheadline).disabled(model.busy)
            }
            if !model.staffDirectory.isEmpty {
                Button(needsSetup ? "Back to staff list" : "Update staff list") {
                    setup.toggle(); password = ""; email = ""; passwordFocused = false
                }.font(.subheadline).disabled(model.busy)
            }
            TeachingPrivacyLink().font(.footnote)
        }.padding(36).frame(maxWidth: 470).frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(TeachingColors.background)
            .onDisappear { password = "" }
    }
    private func signIn() {
        guard canSignIn else { return }
        let loginEmail = selectedEmail, loginPassword = password
        let pinStaffID = pinSignIn ? staffID : nil
        passwordFocused = false
        Task {
            if let pinStaffID { await model.signIn(staffID: pinStaffID, pin: loginPassword) }
            else { await model.signIn(email: loginEmail, password: loginPassword) }
            password = ""
        }
    }
}

struct TeachingPrivacyLink: View {
    // Accessible before authentication, including on an unprovisioned iPad.
    private let policyURL = URL(string: "https://altitutor.com/mobile-privacy/#teaching")!
    var body: some View {
        Link("Privacy policy", destination: policyURL)
            .accessibilityIdentifier("teaching-privacy")
    }
}

enum TeachingTheme: String, CaseIterable, Identifiable {
    case light, dark, automatic

    var id: Self { self }
    var colorScheme: ColorScheme? {
        switch self {
        case .light: .light
        case .dark: .dark
        case .automatic: nil
        }
    }
}

enum TeachingColors {
    static let navy = Color(red: 0.02, green: 0.14, blue: 0.26)
    // Shared brand light blue (#92b9c6), also used by TutorWeb's dark theme.
    static let lightBlue = UIColor(red: 146 / 255, green: 185 / 255, blue: 198 / 255, alpha: 1)
    static let accent = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? lightBlue : UIColor(red: 0.02, green: 0.14, blue: 0.26, alpha: 1)
    })
    static let teal = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? lightBlue : UIColor(red: 0.25, green: 0.46, blue: 0.59, alpha: 1)
    })
    static let background = Color(uiColor: .systemGroupedBackground)
}
