import UserNotifications

/** The extension has no authenticated account or private key access.
 * Keep previews private until a shared, authenticated key protocol is deployed.
 */
final class NotificationService: UNNotificationServiceExtension {
  private var handler: ((UNNotificationContent) -> Void)?
  private var content: UNNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    guard let preview = request.content.mutableCopy() as? UNMutableNotificationContent else {
      contentHandler(request.content)
      return
    }
    handler = contentHandler
    content = preview
    let userInfo = request.content.userInfo
    let sender = (userInfo["sender_name"] as? String) ?? (userInfo["senderName"] as? String) ?? (userInfo["sender"] as? String)
    if let sender = sender?.trimmingCharacters(in: .whitespacesAndNewlines), !sender.isEmpty {
      preview.title = "New message from \(sender)"
    } else if preview.title.isEmpty || preview.title == "Default" {
      preview.title = "MyDearPartner"
    }

    if userInfo["encrypted_text"] != nil {
      preview.body = "You received a new message"
    } else if let unencrypted = (userInfo["notification_body"] as? String) ?? (userInfo["body"] as? String) ?? (userInfo["text"] as? String), !unencrypted.isEmpty {
      preview.body = unencrypted
    }
    finish()
  }

  override func serviceExtensionTimeWillExpire() { finish() }

  private func finish() {
    guard let handler, let content else { return }
    self.handler = nil
    handler(content)
  }
}
