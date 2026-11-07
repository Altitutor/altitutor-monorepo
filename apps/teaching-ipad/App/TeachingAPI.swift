import Foundation
import Security
import CryptoKit
import TeachingCore

struct TutorProfile: Codable, Identifiable, Equatable {
    let id: UUID
    let userID: UUID
    let name: String
    let canSubmitLogs: Bool
}
struct StaffLogin: Codable, Identifiable { let id: UUID; let name: String; let email: String }
struct Participant: Codable, Identifiable { let id: UUID; let name: String }
struct StaffParticipant: Codable, Identifiable { let id: UUID; let name: String; let type: String }
struct TeachingSession: Codable, Identifiable {
    let id: UUID
    let title: String
    let classroomTitle: String
    let kind: String
    let subjectID: UUID?
    let subjectName: String?
    let startAt: Date
    let endAt: Date
    let room: String?
    let students: [Participant]
    let staff: [StaffParticipant]
    let parents: [Participant]
    var logged: Bool
}
struct Credentials: Codable { let accessToken: String; let refreshToken: String; let expiresAt: Double }
struct AuthEnvelope: Codable { let profile: TutorProfile; let credentials: Credentials }

private struct TeachingPINGrant: Codable {
    let salt: UUID
    let verifier: Data
    let expiresAt: Date
    var failedAttempts = 0
    var session: AuthEnvelope

    static func accepts(_ pin: String) -> Bool {
        pin.utf8.count == 4 && pin.utf8.allSatisfy { (48...57).contains($0) }
    }

    static func digest(_ pin: String, salt: UUID) -> Data {
        Data(SHA256.hash(data: Data((salt.uuidString + pin).utf8)))
    }
}
struct LibraryTopic: Decodable, Identifiable {
    let id: UUID
    let name: String
    let parentID: UUID?
    let index: Double
    let subjectID: UUID
    let subjectName: String
}
struct LibrarySubject: Decodable, Identifiable {
    let id: UUID
    let name: String
    let shortName: String
    let yearLevel: Int?
}
struct ResourcePage: Decodable { let subjects: [LibrarySubject]; let resources: [TeachingResource]; let topics: [LibraryTopic]; let nextOffset: Int? }
struct DownloadLink: Decodable { let url: URL; let external: Bool }
struct APIError: LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { message }
}

/// Session credentials are device-only, never written into lesson files or UserDefaults.
struct TeachingKeychain {
    let account: String
    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.altitutor.teaching.session", kSecAttrAccount as String: account]
    }
    func load<T: Decodable>(_ type: T.Type) throws -> T? {
        var request = query
        request[kSecReturnData as String] = true
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw APIError(status: 0, message: "Unlock this iPad to restore your session.") }
        return try JSONDecoder().decode(type, from: data)
    }
    func save<T: Encodable>(_ value: T) throws {
        let data = try JSONEncoder().encode(value)
        let updated = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if updated == errSecItemNotFound {
            var request = query
            request[kSecValueData as String] = data
            request[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            guard SecItemAdd(request as CFDictionary, nil) == errSecSuccess else { throw APIError(status: 0, message: "Could not securely save your session.") }
        } else if updated != errSecSuccess { throw APIError(status: 0, message: "Could not securely update your session.") }
    }
    func remove() throws {
        let status = SecItemDelete(query as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound { throw APIError(status: 0, message: "Could not remove this session. Keep the iPad unlocked and retry sign-out.") }
    }
}

@MainActor final class TeachingAPI {
    let baseURL: URL
    let namespace: String
    private let keychain: TeachingKeychain
    private let staffKeychain: TeachingKeychain
    private(set) var session: AuthEnvelope?
    private var refreshTask: Task<AuthEnvelope, Error>?
    private var generation = 0
    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: value) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: value) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Invalid lesson timestamp"))
        }
        return decoder
    }()
    init() {
        let configured = Bundle.main.object(forInfoDictionaryKey: "TeachingAPIURL") as? String ?? "https://tutor.altitutor.com"
        #if DEBUG
        let value = ProcessInfo.processInfo.environment["TEACHING_API_URL"] ?? configured
        #else
        let value = configured
        #endif
        let url = URL(string: value) ?? URL(string: "https://tutor.altitutor.com")!
        baseURL = url
        namespace = SHA256.hash(data: Data(url.absoluteString.utf8)).map { String(format: "%02x", $0) }.joined()
        keychain = TeachingKeychain(account: namespace)
        staffKeychain = TeachingKeychain(account: namespace + ":staff-directory")
    }
    func restore() throws -> TutorProfile? { session = try keychain.load(AuthEnvelope.self); return session?.profile }
    func cachedStaffDirectory() throws -> [StaffLogin] { try staffKeychain.load([StaffLogin].self) ?? [] }
    func refreshStaffDirectory() async throws -> [StaffLogin] {
        let staff: [StaffLogin] = try await request("staff-directory")
        guard !staff.isEmpty else { throw APIError(status: 503, message: "No active staff are available. Please contact an administrator.") }
        try staffKeychain.save(staff)
        return staff
    }
    func signIn(email: String, password: String) async throws -> TutorProfile {
        let epoch = generation
        let result: AuthEnvelope = try await exchange(["action": "signIn", "email": email, "password": password])
        guard epoch == generation else { throw CancellationError() }
        try keychain.save(result); session = result
        return result.profile
    }
    private func pinKeychain(_ staffID: UUID) -> TeachingKeychain {
        TeachingKeychain(account: namespace + ":pin:" + staffID.uuidString)
    }

    func hasPIN(for staffID: UUID) -> Bool {
        guard let grant = try? pinKeychain(staffID).load(TeachingPINGrant.self) else { return false }
        return grant.expiresAt > Date() && grant.failedAttempts < 5
    }

    func setPIN(_ pin: String, password: String, staff: StaffLogin) async throws {
        guard TeachingPINGrant.accepts(pin), session?.profile.id == staff.id else {
            throw APIError(status: 400, message: "Enter a four-digit PIN.")
        }
        let epoch = generation
        // A fresh password check also creates a separate device credential for this
        // remembered tutor. An unattended active workspace cannot enroll a PIN.
        let verified = try await exchange(["action": "signIn", "email": staff.email, "password": password])
        guard epoch == generation, session?.profile.id == staff.id else { throw CancellationError() }
        guard verified.profile.id == staff.id, verified.profile.canSubmitLogs else {
            throw APIError(status: 403, message: "An active staff account is required to set a PIN.")
        }
        let salt = UUID()
        try pinKeychain(staff.id).save(TeachingPINGrant(salt: salt, verifier: TeachingPINGrant.digest(pin, salt: salt),
            expiresAt: Date().addingTimeInterval(30 * 24 * 60 * 60), session: verified))
    }

    func removePIN(for staffID: UUID) throws {
        try pinKeychain(staffID).remove()
    }

    func signIn(staffID: UUID, pin: String) async throws -> TutorProfile {
        let key = pinKeychain(staffID)
        let usePassword = APIError(status: 401, message: "Sign in with your password to set a new PIN on this iPad.")
        guard TeachingPINGrant.accepts(pin), var grant = try key.load(TeachingPINGrant.self),
              grant.session.profile.id == staffID, grant.expiresAt > Date(), grant.failedAttempts < 5 else { throw usePassword }
        guard grant.verifier == TeachingPINGrant.digest(pin, salt: grant.salt) else {
            grant.failedAttempts += 1
            try key.save(grant)
            if grant.failedAttempts == 5 {
                try key.remove()
                throw usePassword
            }
            throw APIError(status: 400, message: "Incorrect PIN. Try again or use your password.")
        }
        let epoch = generation
        let verified: AuthEnvelope
        do {
            // A remembered user must still pass the server's active-staff check.
            verified = try await exchange(["action": "refresh", "refreshToken": grant.session.credentials.refreshToken])
        } catch let failure as APIError where failure.status == 401 || failure.status == 403 {
            guard epoch == generation else { throw CancellationError() }
            try key.remove()
            throw usePassword
        }
        guard epoch == generation else { throw CancellationError() }
        guard verified.profile.id == staffID, verified.profile.canSubmitLogs else {
            try key.remove()
            throw usePassword
        }
        grant.failedAttempts = 0
        grant.session = verified
        try key.save(grant)
        try keychain.save(verified)
        session = verified
        return verified.profile
    }

    func signOut() throws {
        try keychain.remove()
        generation += 1; refreshTask?.cancel(); refreshTask = nil; session = nil
    }
    private func exchange(_ body: [String: String]) async throws -> AuthEnvelope {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/teaching/auth"))
        request.httpMethod = "POST"; request.httpBody = try JSONEncoder().encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await send(request)
    }
    private func credentials() async throws -> Credentials {
        guard let current = session else { throw APIError(status: 401, message: "Please sign in.") }
        if current.credentials.expiresAt > Date().timeIntervalSince1970 + 60 { return current.credentials }
        let epoch = generation
        if refreshTask == nil { refreshTask = Task { try await self.exchange(["action": "refresh", "refreshToken": current.credentials.refreshToken]) } }
        guard let refreshTask else { throw CancellationError() }
        defer { if epoch == generation { self.refreshTask = nil } }
        let refreshed = try await refreshTask.value
        guard epoch == generation, refreshed.profile.id == current.profile.id else { throw CancellationError() }
        let remembered = pinKeychain(current.profile.id)
        if var grant = try remembered.load(TeachingPINGrant.self),
           grant.session.credentials.refreshToken == current.credentials.refreshToken {
            grant.session = refreshed
            try remembered.save(grant)
        }
        try keychain.save(refreshed); session = refreshed
        return refreshed.credentials
    }
    func request<T: Decodable>(_ path: String, query: [URLQueryItem] = [], body: Data? = nil) async throws -> T {
        let epoch = generation
        let credential = try await credentials()
        var components = URLComponents(url: baseURL.appendingPathComponent("api/teaching/" + path), resolvingAgainstBaseURL: false)!
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else { throw APIError(status: 0, message: "Invalid teaching URL.") }
        var request = URLRequest(url: url)
        request.setValue("Bearer " + credential.accessToken, forHTTPHeaderField: "Authorization")
        if let body { request.httpMethod = "POST"; request.httpBody = body; request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        do {
            let result: T = try await send(request)
            guard generation == epoch else { throw CancellationError() }
            return result
        } catch {
            guard generation == epoch else { throw CancellationError() }
            throw error
        }
    }
    private struct Failure: Decodable { let error: String; let code: String? }
    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        var request = request; request.timeoutInterval = 30; request.cachePolicy = .reloadIgnoringLocalCacheData
        guard request.url?.scheme == "https" || (request.url?.host == "127.0.0.1" || request.url?.host == "localhost") else {
            throw APIError(status: 0, message: "Teaching requires a secure server connection.")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError(status: 0, message: "No response from teaching services.") }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError(status: http.statusCode, message: (try? JSONDecoder().decode(Failure.self, from: data).error) ?? "Teaching services are temporarily unavailable.")
        }
        return try Self.decoder.decode(T.self, from: data)
    }
    func upload(_ snapshot: TeachingPDFSnapshot, sessionID: UUID, document: CachedDocument,
                purpose: String, canonicalResourceID: UUID?) async throws -> UUID {
        struct Input: Encodable {
            let sessionID: UUID; let documentID: UUID; let purpose: String; let canonicalResourceID: UUID?
            let filename: String; let sizeBytes: Int; let sha256: String
        }
        struct Staged: Decodable { let id: UUID; let uploadURL: URL? }
        struct Complete: Decodable { let id: UUID; let state: String }
        let epoch = generation
        let title = URL(fileURLWithPath: document.source.title).deletingPathExtension().lastPathComponent
        let input = Input(sessionID: sessionID, documentID: document.id, purpose: purpose,
                          canonicalResourceID: canonicalResourceID, filename: String(decoding: title.utf16.prefix(140), as: UTF16.self) + " — lesson.pdf",
                          sizeBytes: snapshot.sizeBytes, sha256: snapshot.sha256)
        let staged: Staged = try await request("uploads", body: JSONEncoder().encode(input))
        guard epoch == generation else { throw CancellationError() }
        if let url = staged.uploadURL {
            guard url.scheme == "https" || url.host == "127.0.0.1" || url.host == "localhost" else {
                throw APIError(status: 0, message: "The upload requires a secure connection.")
            }
            var upload = URLRequest(url: url); upload.httpMethod = "PUT"; upload.timeoutInterval = 120
            upload.setValue("application/pdf", forHTTPHeaderField: "Content-Type")
            upload.setValue("false", forHTTPHeaderField: "x-upsert")
            // This signed URL authorizes only its immutable private object. Never forward our bearer token.
            do {
                _ = try await URLSession.shared.upload(for: upload, fromFile: snapshot.url)
            } catch {
                guard epoch == generation else { throw CancellationError() }
                // A response can be lost after Storage accepted immutable bytes.
                // Completion below verifies the exact hash before anything can use them.
            }
            guard epoch == generation else { throw CancellationError() }
        }
        let completed: Complete = try await request("uploads/" + staged.id.uuidString + "/complete", body: Data("{}".utf8))
        guard epoch == generation else { throw CancellationError() }
        return completed.id
    }
    func download(_ source: TeachingDocument, sessionID: UUID? = nil) async throws -> Data {
        if source.externalURL != nil { return Data() }
        let link: DownloadLink = try await request("documents/" + source.id.uuidString, query: sessionID.map { [.init(name: "sessionID", value: $0.uuidString)] } ?? [])
        return try await downloadPDF(link)
    }

    func downloadWorkspacePDF(_ artifactID: UUID) async throws -> Data {
        let link: DownloadLink = try await request("workspace/" + artifactID.uuidString)
        return try await downloadPDF(link)
    }

    private func downloadPDF(_ link: DownloadLink) async throws -> Data {
        guard !link.external, link.url.scheme == "https" || link.url.host == "127.0.0.1" || link.url.host == "localhost" else {
            throw APIError(status: 0, message: "This resource is an external link.")
        }
        var request = URLRequest(url: link.url); request.timeoutInterval = 60
        let (temporary, response) = try await URLSession.shared.download(for: request)
        defer { try? FileManager.default.removeItem(at: temporary) }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw APIError(status: 0, message: "Could not download this PDF. Please retry.") }
        let size = try temporary.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size > 0, size <= 100_000_000 else { throw APIError(status: 0, message: "This file is empty or too large for this iPad download.") }
        let data = try Data(contentsOf: temporary)
        guard !data.isEmpty, data.count <= 100_000_000 else { throw APIError(status: 0, message: "This file is empty or too large for this iPad download.") }
        return data
    }
}
