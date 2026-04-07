import { supabase, APP_CONFIG } from './apiClient.js';

function cleanPayload(payload = {}) {
  const next = {};
  Object.entries(payload).forEach(([key, value]) => {
    next[key] = value === undefined ? null : value;
  });
  return next;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return false;
  const v = String(value).trim().toLowerCase();
  return ['si', 'sí', 'true', '1', 'x', 'yes'].includes(v);
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function getProveedores({ onlyActive = true } = {}) {
  let query = supabase.from('proveedores').select('*').order('razon_social', { ascending: true });
  if (onlyActive) query = query.eq('activo', true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getProveedorCompleto(proveedorId) {
  const [proveedor, contactos, visitas, iniciativas, acuerdos, hoteleria, programas] = await Promise.all([
    getProveedorById(proveedorId),
    getContactosByProveedor(proveedorId),
    getVisitasByProveedor(proveedorId),
    getRows('iniciativas', proveedorId),
    getRows('acuerdos', proveedorId),
    getRows('hoteleria', proveedorId),
    getRows('programas', proveedorId)
  ]);

  return { proveedor, contactos, visitas, iniciativas, acuerdos, hoteleria, programas };
}

export async function getProveedorById(id) {
  const { data, error } = await supabase.from('proveedores').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createProveedor(payload) {
  const { data, error } = await supabase
    .from('proveedores')
    .insert([cleanPayload(payload)])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProveedor(id, payload) {
  const { data, error } = await supabase
    .from('proveedores')
    .update(cleanPayload(payload))
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function softDeleteProveedor(id) {
  const { error } = await supabase
    .from('proveedores')
    .update({ activo: false })
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function getContactosByProveedor(proveedorId) {
  const { data, error } = await supabase
    .from('contactos')
    .select('*')
    .eq('proveedor_id', proveedorId)
    .order('contacto_principal', { ascending: false })
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data;
}

export async function saveContacto(payload) {
  const table = supabase.from('contactos');
  const clean = cleanPayload(payload);

  if (clean.id) {
    const { data, error } = await table.update(clean).eq('id', clean.id).select().single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await table.insert([clean]).select().single();
  if (error) throw error;
  return data;
}

export async function deleteContacto(id) {
  const { error } = await supabase.from('contactos').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function getVisitasByProveedor(proveedorId) {
  const { data, error } = await supabase
    .from('visitas')
    .select('*, visita_fotos(*)')
    .eq('proveedor_id', proveedorId)
    .order('fecha_visita', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createVisita(payload) {
  const { data, error } = await supabase.from('visitas').insert([cleanPayload(payload)]).select().single();
  if (error) throw error;
  return data;
}

export async function updateVisita(id, payload) {
  const { data, error } = await supabase
    .from('visitas')
    .update(cleanPayload(payload))
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteVisita(id) {
  const { error } = await supabase.from('visitas').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function uploadVisitaFoto(file, visitaId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `visitas/${visitaId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(APP_CONFIG.STORAGE_BUCKET_VISITAS || 'visitas-fotos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from(APP_CONFIG.STORAGE_BUCKET_VISITAS || 'visitas-fotos')
    .getPublicUrl(filePath);

  const { data, error } = await supabase
    .from('visita_fotos')
    .insert([{
      visita_id: visitaId,
      file_name: file.name,
      file_url: publicUrlData.publicUrl,
      content_type: file.type
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteVisitaFoto(id) {
  const { error } = await supabase.from('visita_fotos').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function getRows(table, proveedorId) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('proveedor_id', proveedorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function saveRow(table, payload) {
  const clean = cleanPayload(payload);
  const source = supabase.from(table);

  if (clean.id) {
    const { data, error } = await source.update(clean).eq('id', clean.id).select().single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await source.insert([clean]).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function bulkUpsertProveedores(rows) {
  const payload = rows.map((row) => ({
    proveedor_codigo: row.proveedor_codigo?.trim(),
    rut_empresa: row.rut_empresa || null,
    razon_social: row.razon_social?.trim(),
    nombre_fantasia: row.nombre_fantasia || null,
    comuna: row.comuna || null,
    localidad: row.localidad || null,
    direccion: row.direccion || null,
    telefono: row.telefono || null,
    email: row.email || null,
    sitio_web: row.sitio_web || null,
    descripcion: row.descripcion || null,
    giro_principal: row.giro_principal || null,
    giros_secundarios: row.giros_secundarios || null,
    categoria: row.categoria || null,
    subcategoria: row.subcategoria || null,
    tamano_empresa: row.tamano_empresa || null,
    facturacion_rango: row.facturacion_rango || null,
    estado_validacion: row.estado_validacion || 'pendiente',
    tiene_servicio_am: normalizeBoolean(row.tiene_servicio_am),
    estado_servicio_am: row.estado_servicio_am || null,
    observaciones: row.observaciones || null,
    activo: true
  })).filter((row) => row.proveedor_codigo && row.razon_social);

  const { data, error } = await supabase
    .from('proveedores')
    .upsert(payload, { onConflict: 'proveedor_codigo' })
    .select();

  if (error) throw error;
  return data;
}

export async function bulkImportBundle(bundle) {
  const summary = {
    proveedores: 0,
    contactos: 0,
    visitas: 0,
    iniciativas: 0,
    acuerdos: 0,
    hoteleria: 0,
    programas: 0
  };

  const proveedores = await bulkUpsertProveedores(bundle.proveedores || []);
  summary.proveedores = proveedores.length;

  if (!proveedores.length) return summary;

  const providerByCode = new Map(proveedores.map((p) => [p.proveedor_codigo, p.id]));

  async function bulkInsertRelated(table, rows, mapper) {
    if (!rows?.length) return 0;
    const payload = rows
      .map((row) => mapper(row, providerByCode.get(row.proveedor_codigo)))
      .filter(Boolean);

    if (!payload.length) return 0;

    const { error, data } = await supabase.from(table).insert(payload).select();
    if (error) throw error;
    return data.length;
  }

  summary.contactos = await bulkInsertRelated('contactos', bundle.contactos, (row, proveedorId) => {
    if (!proveedorId || !row.nombre) return null;
    return {
      proveedor_id: proveedorId,
      nombre: row.nombre,
      cargo: row.cargo || null,
      telefono: row.telefono || null,
      email: row.email || null,
      contacto_principal: normalizeBoolean(row.contacto_principal)
    };
  });

  summary.visitas = await bulkInsertRelated('visitas', bundle.visitas, (row, proveedorId) => {
    if (!proveedorId || !row.fecha_visita) return null;
    return {
      proveedor_id: proveedorId,
      fecha_visita: row.fecha_visita,
      autor: row.autor || null,
      resumen: row.resumen || null,
      detalle: row.detalle || null,
      compromiso: row.compromiso || null,
      proxima_accion: row.proxima_accion || null
    };
  });

  summary.iniciativas = await bulkInsertRelated('iniciativas', bundle.iniciativas, (row, proveedorId) => {
    if (!proveedorId || !row.nombre) return null;
    return {
      proveedor_id: proveedorId,
      nombre: row.nombre,
      tipo: row.tipo || null,
      estado: row.estado || null,
      descripcion: row.descripcion || null,
      fecha_inicio: row.fecha_inicio || null,
      fecha_termino: row.fecha_termino || null,
      responsable: row.responsable || null
    };
  });

  summary.acuerdos = await bulkInsertRelated('acuerdos', bundle.acuerdos, (row, proveedorId) => {
    if (!proveedorId || !row.titulo) return null;
    return {
      proveedor_id: proveedorId,
      titulo: row.titulo,
      descripcion: row.descripcion || null,
      estado: row.estado || null,
      fecha_acuerdo: row.fecha_acuerdo || null,
      fecha_vencimiento: row.fecha_vencimiento || null
    };
  });

  summary.hoteleria = await bulkInsertRelated('hoteleria', bundle.hoteleria, (row, proveedorId) => {
    if (!proveedorId) return null;
    return {
      proveedor_id: proveedorId,
      cliente: row.cliente || null,
      habitaciones_totales: parseNumber(row.habitaciones_totales),
      habitaciones_ocupadas: parseNumber(row.habitaciones_ocupadas),
      habitaciones_disponibles: parseNumber(row.habitaciones_disponibles),
      observaciones: row.observaciones || null,
      fecha_reporte: row.fecha_reporte || null
    };
  });

  summary.programas = await bulkInsertRelated('programas', bundle.programas, (row, proveedorId) => {
    if (!proveedorId || !row.nombre) return null;
    return {
      proveedor_id: proveedorId,
      nombre: row.nombre,
      descripcion: row.descripcion || null,
      estado: row.estado || null,
      fecha_inicio: row.fecha_inicio || null,
      fecha_termino: row.fecha_termino || null
    };
  });

  return summary;
}

export async function saveProveedorBundle(bundle) {
  const { proveedor, contactos = [], visitas = [], iniciativas = [], acuerdos = [], hoteleria = [], programas = [] } = bundle;

  if (!proveedor) throw new Error('Falta bundle.proveedor');

  const savedProveedor = proveedor.id
    ? await updateProveedor(proveedor.id, proveedor)
    : await createProveedor(proveedor);

  const proveedorId = savedProveedor.id;

  for (const contacto of contactos) {
    await saveContacto({ ...contacto, proveedor_id: proveedorId });
  }

  for (const visita of visitas) {
    await (visita.id ? updateVisita(visita.id, { ...visita, proveedor_id: proveedorId }) : createVisita({ ...visita, proveedor_id: proveedorId }));
  }

  for (const row of iniciativas) {
    await saveRow('iniciativas', { ...row, proveedor_id: proveedorId });
  }

  for (const row of acuerdos) {
    await saveRow('acuerdos', { ...row, proveedor_id: proveedorId });
  }

  for (const row of hoteleria) {
    await saveRow('hoteleria', { ...row, proveedor_id: proveedorId });
  }

  for (const row of programas) {
    await saveRow('programas', { ...row, proveedor_id: proveedorId });
  }

  return savedProveedor;
}
