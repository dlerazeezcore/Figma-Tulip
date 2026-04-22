import Foundation
import Capacitor
import FirebaseCore
import FirebaseMessaging

public let isCapacitorApp = true

public enum TulipFirebasePushBridge {
    private static let messagingBridge = TulipMessagingBridge()

    public static func configureIfAvailable() {
        if FirebaseApp.app() == nil,
           Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        }

        Messaging.messaging().delegate = messagingBridge
    }

    public static func didRegisterForRemoteNotifications(deviceToken: Data) {
        messagingBridge.didRegisterForRemoteNotifications(deviceToken: deviceToken)
    }

    public static func didFailToRegisterForRemoteNotifications(error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}

private final class TulipMessagingBridge: NSObject, MessagingDelegate {
    private var latestApnsToken: Data?
    private var latestFcmToken: String?

    func didRegisterForRemoteNotifications(deviceToken: Data) {
        latestApnsToken = deviceToken

        guard FirebaseApp.app() != nil else {
            NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
            return
        }

        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { token, error in
            if let error {
                NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
                return
            }

            if let token, !token.isEmpty {
                self.latestFcmToken = token
                NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
                return
            }

            NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
        }
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken, !fcmToken.isEmpty else {
            return
        }

        if latestFcmToken == fcmToken {
            return
        }

        latestFcmToken = fcmToken

        if let latestApnsToken {
            Messaging.messaging().apnsToken = latestApnsToken
        }

        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: fcmToken)
    }
}
