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
    var body: some View {
        VStack(spacing: 24) {
            Text("Altitutor").font(.system(size: 42, weight: .bold)).foregroundStyle(TeachingColors.navy)
            Text("Your teaching day, ready.").font(.title2).foregroundStyle(.secondary)
            VStack(spacing: 16) {
                TextField("Tutor email", text: $email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier("teaching-email")
                SecureField("Password", text: $password).textContentType(.password).accessibilityIdentifier("teaching-password")
            }.textFieldStyle(.roundedBorder)
            Button { Task { await model.signIn(email: email, password: password); password = "" } } label: {
                HStack { if model.busy { ProgressView().tint(.white) }; Text("Sign in").frame(maxWidth: .infinity) }
            }.buttonStyle(.borderedProminent).controlSize(.large).disabled(model.busy || email.isEmpty || password.isEmpty).accessibilityIdentifier("teaching-sign-in")
            Text("Use your existing Altitutor tutor account.").font(.footnote).foregroundStyle(.secondary)
        }.padding(42).frame(maxWidth: 440).frame(maxWidth: .infinity, maxHeight: .infinity).background(TeachingColors.background)
    }
}

enum TeachingColors {
    static let navy = Color(red: 0.02, green: 0.14, blue: 0.26)
    static let teal = Color(red: 0.25, green: 0.46, blue: 0.59)
    static let background = Color(uiColor: .systemGroupedBackground)
}
