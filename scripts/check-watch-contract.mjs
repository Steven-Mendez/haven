#!/usr/bin/env node
// Verifica que el contrato del Watch en TS y su espejo en Swift coincidan:
// versión, tipos de mensaje y campos de cada payload (y de Item).
// Uso: pnpm check:contract
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, root)), 'utf8');

const TS_WATCH = 'packages/shared/src/watch.ts';
const TS_ITEMS = 'packages/shared/src/items.ts';
const SWIFT = 'apps/mobile/targets/watch/Contract/Contract.swift';

const tsWatch = read(TS_WATCH);
const tsItems = read(TS_ITEMS);
const swift = read(SWIFT);
const errors = [];

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** Devuelve el contenido entre la llave que abre en `from` y su cierre. */
function block(src, from) {
  const start = src.indexOf('{', from);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start + 1, i);
  }
  throw new Error('Llave sin cerrar');
}

/** Parte por `sep` solo en profundidad 0 de llaves/ángulos. */
function splitTop(src, sep) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of src) {
    if (ch === '{' || ch === '<') depth++;
    else if (ch === '}' || ch === '>') depth--;
    if (depth === 0 && sep.includes(ch)) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const TS_TO_SWIFT = { string: 'String', boolean: 'Bool', number: 'Double' };
function swiftType(ts) {
  ts = ts.trim();
  if (ts.endsWith('[]')) return `[${swiftType(ts.slice(0, -2))}]`;
  return TS_TO_SWIFT[ts] ?? ts;
}

/** "{ a: string; b?: X[] }" → { a: 'String', b: '[X]?' } */
function tsFields(body) {
  const fields = {};
  for (const part of splitTop(stripComments(body), ';,\n')) {
    const m = part.match(/^(\w+)(\?)?\s*:\s*(.+)$/s);
    if (m) fields[m[1]] = swiftType(m[3]) + (m[2] ? '?' : '');
  }
  return fields;
}

function swiftFields(name) {
  const m = swift.match(new RegExp(`struct\\s+${name}\\b[^{]*`));
  if (!m) return null;
  const fields = {};
  // Solo propiedades almacenadas (`let`); las `var` calculadas no viajan en el JSON.
  for (const f of stripComments(block(swift, m.index)).matchAll(/\blet\s+(\w+)\s*:\s*([^\n;=]+)/g)) {
    fields[f[1]] = f[2].trim();
  }
  return fields;
}

function compare(label, ts, sw) {
  if (!sw) return errors.push(`${label}: falta el struct en ${SWIFT}`);
  for (const k of new Set([...Object.keys(ts), ...Object.keys(sw)])) {
    if (!(k in sw)) errors.push(`${label}.${k}: está en TS pero falta en Swift`);
    else if (!(k in ts)) errors.push(`${label}.${k}: está en Swift pero falta en TS`);
    else if (ts[k] !== sw[k]) errors.push(`${label}.${k}: TS espera ${ts[k]}, Swift tiene ${sw[k]}`);
  }
}

// 1. Versión
const tsVersion = tsWatch.match(/WATCH_CONTRACT_VERSION\s*=\s*(\d+)/)?.[1];
const swVersion = swift.match(/static\s+let\s+version\s*=\s*(\d+)/)?.[1];
if (!tsVersion || !swVersion) errors.push('No se pudo leer la versión del contrato en TS o Swift');
else if (tsVersion !== swVersion) errors.push(`Versión: TS=${tsVersion}, Swift=${swVersion}`);

// 2. Tipos de mensaje
const messagesAt = tsWatch.search(/export\s+type\s+WatchMessages\s*=/);
if (messagesAt < 0) throw new Error(`No se encontró WatchMessages en ${TS_WATCH}`);
const messages = {};
for (const part of splitTop(stripComments(block(tsWatch, messagesAt)), ';\n')) {
  const m = part.match(/^(\w+)\s*:\s*(.+)$/s);
  if (m) messages[m[1]] = m[2].trim();
}

const enumAt = swift.search(/enum\s+WatchMessageType\b/);
const swCases = enumAt < 0 ? [] : [...stripComments(block(swift, enumAt)).matchAll(/\bcase\s+([^\n]+)/g)]
  .flatMap((m) => m[1].split(',').map((c) => c.trim().split(/\s|=/)[0]))
  .filter(Boolean);

for (const t of Object.keys(messages)) if (!swCases.includes(t)) errors.push(`Mensaje "${t}": falta en el enum WatchMessageType de Swift`);
for (const t of swCases) if (!(t in messages)) errors.push(`Mensaje "${t}": está en Swift pero falta en WatchMessages (TS)`);

// 3. Payloads: mensaje `fooBar` ↔ struct `FooBarPayload`
for (const [type, payload] of Object.entries(messages)) {
  const struct = `${type[0].toUpperCase()}${type.slice(1)}Payload`;
  let fields;
  if (payload.startsWith('{')) fields = tsFields(payload.slice(1, payload.lastIndexOf('}')));
  else if (/^Record<\s*string\s*,\s*never\s*>$/.test(payload)) fields = {};
  else {
    errors.push(`Mensaje "${type}": payload "${payload}" no soportado por el verificador (usa un objeto literal o Record<string, never>)`);
    continue;
  }
  compare(struct, fields, swiftFields(struct));
}

// 4. Modelos compartidos que viajan al reloj
const itemAt = tsItems.search(/export\s+type\s+Item\s*=/);
if (itemAt < 0) errors.push(`No se encontró el tipo Item en ${TS_ITEMS}`);
else compare('Item', tsFields(block(tsItems, itemAt)), swiftFields('Item'));

if (errors.length) {
  console.error(`✗ El contrato del Watch no coincide (${TS_WATCH} ↔ ${SWIFT}):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ Contrato del Watch v${tsVersion} sincronizado (${Object.keys(messages).length} mensajes)`);
