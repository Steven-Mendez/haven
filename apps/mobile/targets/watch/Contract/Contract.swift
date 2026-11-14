import Foundation

// Shared contracts §4 · Watch–phone contract (WatchConnectivity, JSON).
// Exact mirror of packages/core/src/contracts/watch.ts: keep both identical.
//
// Common envelope: { v, type, crewMember, simulated, sentAt, payload }. `simulated` is frozen: always false when
// sending, ignored when receiving, never shown (EQUIPOS.md «Producto real»).
//   status      phone → watch   StatusPayload
//   mood        watch → phone   MoodPayload
//   emergency   watch → phone   EmergencyPayload
//   monitor     watch → phone   MonitorPayload
//   crewHaptic  phone → watch   CrewHapticPayload
//   emergencyEnd phone → watch  EmergencyEndPayload (emergency closed on the phone)
// Dates are ISO 8601 strings (JS ones carry milliseconds: `Date.toISOString()`).

enum WatchContract {
    /// `WATCH_CONTRACT_VERSION`.
    static let version = 1
    /// WatchConnectivity dictionary key carrying the serialized envelope (same in HavenWatchModule.swift).
    static let jsonKey = "json"
}

/// `Level` (contracts §5).
enum Level: String, Codable, CaseIterable {
    case green, amber, red, pending
}

/// `WatchMessageType`.
enum WatchMessageType: String, Codable, CaseIterable {
    case status, mood, emergency, monitor, crewHaptic, emergencyEnd
}

/// Payload bound to its message type, so envelopes can't carry the wrong `type`.
protocol WatchPayload: Codable {
    static var type: WatchMessageType { get }
}

/// `WatchEnvelope<T>` with a typed payload.
struct WatchEnvelope<Payload: WatchPayload>: Codable {
    let v: Int
    let type: WatchMessageType
    let crewMember: String
    let simulated: Bool
    let sentAt: String
    let payload: Payload

    /// `simulated` is part of the frozen contract and always false (EQUIPOS.md «Producto real»).
    init(crewMember: String, sentAt: String, payload: Payload) {
        self.v = WatchContract.version
        self.type = Payload.type
        self.crewMember = crewMember
        self.simulated = false
        self.sentAt = sentAt
        self.payload = payload
    }

}

struct StatusPayload: WatchPayload, Equatable {
    static let type = WatchMessageType.status
    let overallLevel: Level
    let nextPending: String?
    let evaluatedAt: String
    /// Phone UI language, `"es"` or `"en"` (optional in the TS contract). The bridge sets `Language.current` from it.
    let language: String?
}

struct MoodPayload: WatchPayload, Equatable {
    static let type = WatchMessageType.mood
    let score: Int  // 1-5
    let takenAt: String
}

struct EmergencyPayload: WatchPayload, Equatable {
    static let type = WatchMessageType.emergency
    enum Origin: String, Codable, CaseIterable {
        case button, fall, heartRate, rhythm, spo2
    }
    let origin: Origin
    let takenAt: String
    /// Reading that fired an automatic trigger (heartRate / spo2), so the alarm value reaches Earth.
    var heartRate: Double? = nil
    var spo2: Double? = nil
    var readingAt: String? = nil
}

struct MonitorPayload: WatchPayload, Equatable {
    static let type = WatchMessageType.monitor
    let heartRate: Double
    let takenAt: String
    let spo2: Double?
    let spo2TakenAt: String?
}

struct CrewHapticPayload: WatchPayload, Equatable {
    static let type = WatchMessageType.crewHaptic
    let message: String
}

/// Phone → watch: the emergency was closed on the phone; the watch stops the patient monitor.
struct EmergencyEndPayload: WatchPayload, Equatable {
    static let type = WatchMessageType.emergencyEnd
    let endedAt: String
}

/// Any payload of the contract, chosen by `type`.
enum AnyWatchPayload: Equatable {
    case status(StatusPayload)
    case mood(MoodPayload)
    case emergency(EmergencyPayload)
    case monitor(MonitorPayload)
    case crewHaptic(CrewHapticPayload)
    case emergencyEnd(EmergencyEndPayload)
}

/// Envelope whose type is not known in advance: decodes `payload` according to `type`.
/// Use it for everything that arrives through the bridge.
struct AnyWatchEnvelope: Codable, Equatable {
    let v: Int
    let type: WatchMessageType
    let crewMember: String
    let simulated: Bool
    let sentAt: String
    let payload: AnyWatchPayload

    private enum CodingKeys: String, CodingKey {
        case v, type, crewMember, simulated, sentAt, payload
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        v = try c.decode(Int.self, forKey: .v)
        type = try c.decode(WatchMessageType.self, forKey: .type)
        crewMember = try c.decode(String.self, forKey: .crewMember)
        simulated = try c.decode(Bool.self, forKey: .simulated)
        sentAt = try c.decode(String.self, forKey: .sentAt)
        switch type {
        case .status: payload = .status(try c.decode(StatusPayload.self, forKey: .payload))
        case .mood: payload = .mood(try c.decode(MoodPayload.self, forKey: .payload))
        case .emergency: payload = .emergency(try c.decode(EmergencyPayload.self, forKey: .payload))
        case .monitor: payload = .monitor(try c.decode(MonitorPayload.self, forKey: .payload))
        case .crewHaptic: payload = .crewHaptic(try c.decode(CrewHapticPayload.self, forKey: .payload))
        case .emergencyEnd: payload = .emergencyEnd(try c.decode(EmergencyEndPayload.self, forKey: .payload))
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(v, forKey: .v)
        try c.encode(type, forKey: .type)
        try c.encode(crewMember, forKey: .crewMember)
        try c.encode(simulated, forKey: .simulated)
        try c.encode(sentAt, forKey: .sentAt)
        switch payload {
        case .status(let p): try c.encode(p, forKey: .payload)
        case .mood(let p): try c.encode(p, forKey: .payload)
        case .emergency(let p): try c.encode(p, forKey: .payload)
        case .monitor(let p): try c.encode(p, forKey: .payload)
        case .crewHaptic(let p): try c.encode(p, forKey: .payload)
        case .emergencyEnd(let p): try c.encode(p, forKey: .payload)
        }
    }
}

// MARK: - ISO 8601 dates

enum ISODate {
    private static let withMilliseconds: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let withoutMilliseconds = ISO8601DateFormatter()

    /// Same as JS `Date.toISOString()`: `2026-10-31T12:00:00.000Z`.
    static func string(_ date: Date) -> String { withMilliseconds.string(from: date) }

    static func date(_ string: String) -> Date? {
        withMilliseconds.date(from: string) ?? withoutMilliseconds.date(from: string)
    }
}
