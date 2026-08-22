self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(self.registration.showNotification(data.title || 'Programação Tênis', {
    body: data.body || 'Um horário foi liberado.',
    icon: '/src/img/ico.png',
    badge: '/src/img/ico.png',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.includes(self.location.origin));
    return existing ? existing.focus() : clients.openWindow(event.notification.data.url);
  }));
});
