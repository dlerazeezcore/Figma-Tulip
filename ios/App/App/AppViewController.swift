import UIKit
import Capacitor

final class AppViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        configureWebViewAppearance()
    }

    private func configureWebViewAppearance() {
        let backgroundColor = UIColor(red: 244.0 / 255.0, green: 248.0 / 255.0, blue: 253.0 / 255.0, alpha: 1)
        view.backgroundColor = backgroundColor
        webView?.backgroundColor = backgroundColor
        webView?.scrollView.backgroundColor = backgroundColor
        webView?.isOpaque = false
    }
}
