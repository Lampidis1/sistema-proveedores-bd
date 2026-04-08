import { getProveedores, getProveedorCompleto, saveProveedorBundle, updateProveedor } from './api.js';
import { importExcelToDatabase } from './excelImport.js';
import { subscribeCoreTables } from './realtime.js';
import { getSession } from './auth.js';

/**
 * Este archivo es el puente entre tu index.html actual y la nueva BD.
 * Lo puedes importar como módulo y llamar sus funciones desde tu UI existente.
 */

let autosaveTimers = new Map();

export async function ensureSessionOrThrow() {
  const session = await getSession();
  if (!session) throw new Error('Debes iniciar sesión antes de usar la base de datos.');
  return session;
}

export async function cargarProveedoresDesdeBD() {
  await ensureSessionOrThrow();
  return await getProveedores();
}

export async function cargarFichaProveedor(proveedorId) {
  await ensureSessionOrThrow();
  return await getProveedorCompleto(proveedorId);
}

export async function guardarFichaCompleta(bundle) {
  await ensureSessionOrThrow();
  return await saveProveedorBundle(bundle);
}

export async function guardarCambiosProveedor(id, payload) {
  await ensureSessionOrThrow();
  return await updateProveedor(id, payload);
}

export async function importarExcelMasivo(file) {
  await ensureSessionOrThrow();
  return await importExcelToDatabase(file);
}

export function activarAutosaveProveedor({ proveedorId, getPayload, delay = 800, onOk, onError }) {
  const key = String(proveedorId || 'nuevo');

  return function triggerAutosave() {
    clearTimeout(autosaveTimers.get(key));
    autosaveTimers.set(key, setTimeout(async () => {
      try {
        const payload = getPayload();
        const result = proveedorId
          ? await guardarCambiosProveedor(proveedorId, payload)
          : await guardarFichaCompleta({ proveedor: payload });
        if (typeof onOk === 'function') onOk(result);
      } catch (error) {
        if (typeof onError === 'function') onError(error);
        else console.error(error);
      }
    }, delay));
  };
}

export function activarRealtime(onChange) {
  return subscribeCoreTables(onChange);
}

/**
 * Ejemplo mínimo de integración con tu HTML actual:
 *
 * import {
 *   cargarProveedoresDesdeBD,
 *   importarExcelMasivo,
 *   activarRealtime
 * } from './js/frontAdapter.js';
 *
 * const fileInput = document.getElementById('fileInput');
 * const btnLoad = document.getElementById('btnLoad');
 *
 * btnLoad.addEventListener('click', async () => {
 *   const file = fileInput.files?.[0];
 *   if (!file) return;
 *   const summary = await importarExcelMasivo(file);
 *   console.log(summary);
 * });
 *
 * const proveedores = await cargarProveedoresDesdeBD();
 * console.log(proveedores);
 *
 * activarRealtime(({ table, payload }) => {
 *   console.log('Cambio realtime', table, payload);
 *   // aquí refrescas tabla, KPIs o ficha abierta
 * });
 */
