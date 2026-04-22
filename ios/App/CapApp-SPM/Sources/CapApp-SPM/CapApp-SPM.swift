import Foundation
import Capacitor
import FirebaseCore
import FirebaseMessaging

/// Tulip Firebase Push Bridge
/// This class handles the integration between Firebase Cloud Messaging and Capacitor Push Notifications.
public enum TulipFirebasePushBridge {
    private static let messagingBridge = TulipMessagingBridge()

    public static func configureIfAvailable() {
        // Only configure if GoogleService-Info.plist exists
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

/// Private bridge to handle Firebase Messaging delegate callbacks and relay them to Capacitor
private final class TulipMessagingBridge: NSObject, MessagingDelegate {
    private var latestApnsToken: Data?
    private var latestFcmToken: String?

    func didRegisterForRemoteNotifications(deviceToken: Data) {
        latestApnsToken = deviceToken

        guard FirebaseApp.app() != nil else {
            // Relay raw token if Firebase isn't configured
            NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
            return
        }

        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { token, error in
            if let error = error {
                NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
                return
            }

            if let token = token, !token.isEmpty {
                self.latestFcmToken = token
                NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
                return
            }

            // Fallback to APNS if FCM fails
            NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
        }
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken = fcmToken, !fcmToken.isEmpty else {
            return
        }

        if latestFcmToken == fcmToken {
            return
        }

        latestFcmToken = fcmToken

        if let latestApnsToken = latestApnsToken {
            Messaging.messaging().apnsToken = latestApnsToken
        }

        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: fcmToken)
    }
}
