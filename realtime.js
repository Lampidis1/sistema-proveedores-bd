import { supabase } from './apiClient.js';

export function subscribeTable(table, callback) {
  return supabase
    .channel(`rt-${table}-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => callback(payload)
    )
    .subscribe();
}

export function subscribeCoreTables(callback) {
  const tables = ['proveedores', 'contactos', 'visitas', 'visita_fotos', 'iniciativas', 'acuerdos', 'hoteleria', 'programas'];
  return tables.map((table) => subscribeTable(table, (payload) => callback({ table, payload })));
}

export async function unsubscribeMany(channels = []) {
  for (const channel of channels) {
    if (channel) {
      await supabase.removeChannel(channel);
    }
  }
}
