// M08 · Actionable notifications — ../obsidian/40 Proyecto/43 Móvil/M08 Notificaciones accionables.md
// No screen. `startNotifications()` is called once from the root layout. Listens to
// 'assessments:changed' (red alert) and 'reading:new' (re-plans reminders); emits 'emergency:open'.
export {
  replanReminders,
  requestNotificationPermission,
  startNotifications,
  useNotificationPermission,
} from './service';
