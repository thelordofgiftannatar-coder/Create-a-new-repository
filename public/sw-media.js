// Background media notification action handler for Prime One PWA
self.addEventListener('notificationclick', function (event) {
  const action = event.action || 'focus';
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'PRIME_ONE_MEDIA_ACTION', action: action });
          if (action === 'focus' || action === '') {
            return client.focus();
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
