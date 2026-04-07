import { bulkImportBundle } from './api.js';

function sheetToJson(workbook, sheetName) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return window.XLSX.utils.sheet_to_json(ws, {
    defval: '',
    raw: false
  });
}

function normalizeDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  return d.toISOString().slice(0, 10);
}

function normalizeRows(rows, dateFields = []) {
  return rows.map((row) => {
    const normalized = {};
    Object.entries(row).forEach(([key, value]) => {
      const cleanKey = String(key).trim();
      normalized[cleanKey] = typeof value === 'string' ? value.trim() : value;
    });

    dateFields.forEach((field) => {
      if (normalized[field]) normalized[field] = normalizeDate(normalized[field]);
    });

    return normalized;
  });
}

export async function parseMassiveExcel(file) {
  if (!window.XLSX) {
    throw new Error('No está disponible XLSX. Debes incluir xlsx.full.min.js en tu HTML.');
  }

  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: 'array' });

  return {
    proveedores: normalizeRows(sheetToJson(workbook, 'Proveedores')),
    contactos: normalizeRows(sheetToJson(workbook, 'Contactos')),
    visitas: normalizeRows(sheetToJson(workbook, 'Visitas'), ['fecha_visita']),
    iniciativas: normalizeRows(sheetToJson(workbook, 'Iniciativas'), ['fecha_inicio', 'fecha_termino']),
    acuerdos: normalizeRows(sheetToJson(workbook, 'Acuerdos'), ['fecha_acuerdo', 'fecha_vencimiento']),
    hoteleria: normalizeRows(sheetToJson(workbook, 'Hoteleria'), ['fecha_reporte']),
    programas: normalizeRows(sheetToJson(workbook, 'Programas'), ['fecha_inicio', 'fecha_termino'])
  };
}

export async function importExcelToDatabase(file) {
  const bundle = await parseMassiveExcel(file);
  return await bulkImportBundle(bundle);
}
