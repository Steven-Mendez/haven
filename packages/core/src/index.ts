import * as configModule from './config';
import { registerActionCatalog } from './engine';

export * from './config';
export * from './contracts';
export * from './engine';

registerActionCatalog((configModule as Record<string, unknown>).actions);
