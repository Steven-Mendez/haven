// M09 · Earth packet and queue — ../obsidian/40 Proyecto/43 Móvil/M09 Paquete a Tierra y cola.md
// Public API of the feature: the send screen (route `send`, «Enviar» and done), the pending-sends
// screen (route `queue`, a diagnosis view reached only from Settings) and `startEarthQueue()`,
// called once from the root layout. Other features talk to the queue through
// the bus: `emergency:close { packet }` and `packet:enqueue { packet }`; it emits `packet:queued`.
export { default } from './screen';
export { default as SendScreen } from './send-screen';
export { startEarthQueue } from './service';
