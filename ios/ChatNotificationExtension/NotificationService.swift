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
    if request.content.userInfo["encrypted_text"] != nil {
      preview.title = "MyDearPartner"
      preview.body = "You have a new message"
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
