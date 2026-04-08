import { supabase } from './apiClient.js';

// ==============================
// LOGIN
// ==============================
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert('Error login: ' + error.message);
    throw error;
  }

  return data;
}

// ==============================
// GET PROVEEDORES DESDE BD
// ==============================
export async function getProveedoresFromDB() {
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .eq('activo', true);

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

// ==============================
// GUARDAR PROVEEDORES (EXCEL)
// ==============================
export async function saveProveedoresToDB(rows) {
  if (!rows || !rows.length) return;

  const payload = rows.map(r => ({
    proveedor_codigo: r.proveedor_codigo || null,
    rut_empresa: r.rut_empresa || null,
    razon_social: r.razon_social || '',
    nombre_fantasia: r.nombre_fantasia || '',
    comuna: r.comuna || '',
    localidad: r.localidad || '',
    direccion: r.direccion || '',
    telefono: r.telefono || '',
    email: r.email || '',
    sitio_web: r.sitio_web || '',
    descripcion: r.descripcion || '',
    giro_principal: r.giro_principal || '',
    categoria: r.categoria || '',
    subcategoria: r.subcategoria || '',
    estado_validacion: r.estado_validacion || 'pendiente',
    activo: true
  }));

  const { error } = await supabase
    .from('proveedores')
    .upsert(payload, { onConflict: 'proveedor_codigo' });

  if (error) {
    console.error(error);
    alert('Error guardando proveedores');
  }
}

// ==============================
// REEMPLAZAR CARGA ORIGINAL
// ==============================
export async function cargarDesdeDB() {
  const proveedores = await getProveedoresFromDB();

  if (!proveedores.length) {
    console.warn('BD vacía → usar Excel');
    return false;
  }

  // 👉 aquí conectamos con tu frontend antiguo
  if (window.renderProveedores) {
    window.renderProveedores(proveedores);
  }

  return true;
}
