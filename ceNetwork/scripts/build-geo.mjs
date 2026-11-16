import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MUN_DIR = path.join(ROOT, 'public', 'geo', 'municipios');
const ESTADOS_OUT = path.join(ROOT, 'public', 'geo', 'mx_estados.geojson');

const ABREVIATURAS = {
  'aguascalientes': 'AGS',
  'baja-california': 'BC',
  'baja-california-sur': 'BCS',
  'campeche': 'CAMP',
  'coahuila-de-zaragoza': 'COAH',
  'colima': 'COL',
  'chiapas': 'CHIS',
  'chihuahua': 'CHIH',
  'ciudad-de-mexico': 'CDMX',
  'durango': 'DGO',
  'guanajuato': 'GTO',
  'guerrero': 'GRO',
  'hidalgo': 'HGO',
  'jalisco': 'JAL',
  'mexico': 'MEX',
  'michoacan-de-ocampo': 'MICH',
  'morelos': 'MOR',
  'nayarit': 'NAY',
  'nuevo-leon': 'NL',
  'oaxaca': 'OAX',
  'puebla': 'PUE',
  'queretaro': 'QRO',
  'quintana-roo': 'QROO',
  'san-luis-potosi': 'SLP',
  'sinaloa': 'SIN',
  'sonora': 'SON',
  'tabasco': 'TAB',
  'tamaulipas': 'TAMPS',
  'tlaxcala': 'TLAX',
  'veracruz-de-ignacio-de-la-llave': 'VER',
  'yucatan': 'YUC',
  'zacatecas': 'ZAC',
};

export function toSlug(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Detecta las propiedades de clave de estado, clave de municipio y nombre en cada archivo
 * y las normaliza a { estado_id, municipio_id, nombre }.
 */
function detectarPropiedades(props, fallbackStateName, fallbackSlug) {
  const keys = Object.keys(props || {});
  const findKey = (candidates) =>
    keys.find((k) => candidates.includes(k.toLowerCase()));

  const kEstadoId = findKey(['estado_id', 'cve_ent', 'id_ent', 'entidad_id', 'state_id', 'cve_edo']);
  const kMunId = findKey(['municipio_id', 'cvegeo', 'cve_mun', 'id_mun', 'mun_id', 'id']);
  const kNombre = findKey(['nombre', 'nomgeo', 'nom_mun', 'name', 'municipio', 'nom_loc']);
  const kEstadoNom = findKey(['estado_nombre', 'nom_ent', 'nombre_estado', 'entidad', 'state_name']);

  const estado_id = String(
    (kEstadoId && props[kEstadoId]) ? props[kEstadoId] : fallbackSlug
  ).trim().padStart(2, '0');

  const rawMunId = (kMunId && props[kMunId]) ? String(props[kMunId]).trim() : '';
  const municipio_id = rawMunId.length === 3 && /^\d{2}$/.test(estado_id)
    ? `${estado_id}${rawMunId}`
    : (rawMunId || `${estado_id}000`);

  const nombre = String(
    (kNombre && props[kNombre]) ? props[kNombre] : 'Sin nombre'
  ).trim();

  const estado_nombre = String(
    (kEstadoNom && props[kEstadoNom]) ? props[kEstadoNom] : fallbackStateName
  ).trim();

  return { estado_id, municipio_id, nombre, estado_nombre };
}

async function simplifyUnderLimit(fcBuf, maxBytes) {
  let outBuf = fcBuf;
  const steps = ['15%', '8%', '4%', '2.5%', '1.5%', '1%', '0.6%'];
  for (const pct of steps) {
    const cmd = `-i input.geojson -simplify visvalingam ${pct} keep-shapes -o output.geojson format=geojson precision=0.0001`;
    const out = await mapshaper.applyCommands(cmd, { 'input.geojson': fcBuf });
    outBuf = out['output.geojson'];
    if (outBuf.byteLength <= maxBytes) break;
  }
  return outBuf;
}

async function main() {
  fs.mkdirSync(MUN_DIR, { recursive: true });
  const files = fs.readdirSync(MUN_DIR).filter((f) => f.endsWith('.json') || f.endsWith('.geojson'));
  console.log(`Encontrados ${files.length} archivos en ${MUN_DIR}`);

  const allNormalizedFeatures = [];

  for (const file of files) {
    const fullPath = path.join(MUN_DIR, file);
    const baseName = file.replace(/\.(geo)?json$/i, '');
    const slug = toSlug(baseName);
    const targetFile = `${slug}.json`;
    const targetPath = path.join(MUN_DIR, targetFile);

    const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const features = (raw.features || []).map((feat) => {
      const det = detectarPropiedades(feat.properties, baseName, slug);
      const abrev = ABREVIATURAS[slug] || det.estado_nombre.slice(0, 4).toUpperCase();
      return {
        type: 'Feature',
        properties: {
          estado_id: det.estado_id,
          municipio_id: det.municipio_id,
          nombre: det.nombre,
          estado_nombre: det.estado_nombre,
          slug,
          abrev,
        },
        geometry: feat.geometry,
      };
    });

    for (const f of features) {
      allNormalizedFeatures.push(f);
    }

    const fcBuf = Buffer.from(JSON.stringify({ type: 'FeatureCollection', features }));
    const outBuf = await simplifyUnderLimit(fcBuf, 900 * 1024);

    if (fullPath !== targetPath) {
      if (fullPath.toLowerCase() === targetPath.toLowerCase()) {
        const tmpPath = `${targetPath}.tmp`;
        fs.writeFileSync(tmpPath, outBuf);
        fs.unlinkSync(fullPath);
        fs.renameSync(tmpPath, targetPath);
      } else {
        fs.writeFileSync(targetPath, outBuf);
        fs.unlinkSync(fullPath);
      }
    } else {
      fs.writeFileSync(targetPath, outBuf);
    }
    const jsWrapperPath = path.join(MUN_DIR, `${slug}.js`);
    fs.writeFileSync(
      jsWrapperPath,
      `window.__CENET_GEO__=window.__CENET_GEO__||{};window.__CENET_GEO__[${JSON.stringify(`geo/municipios/${slug}.json`)}]=${outBuf.toString('utf8')};\n`
    );
    console.log(`  ✓ ${targetFile} (${features.length} muns) -> ${(outBuf.byteLength / 1024).toFixed(1)} KB`);
  }

  console.log('Disolviendo municipios por estado para generar mx_estados.geojson...');
  const allFc = Buffer.from(JSON.stringify({ type: 'FeatureCollection', features: allNormalizedFeatures }));
  const dissolveCmd = [
    '-i all.geojson',
    '-dissolve estado_id copy-fields=estado_nombre,slug,abrev',
    '-each "nombre = estado_nombre, municipio_id = null, delete estado_nombre"',
    '-simplify visvalingam 3% keep-shapes',
    '-o estados.geojson format=geojson precision=0.0001',
  ].join(' ');

  const dissolvedOut = await mapshaper.applyCommands(dissolveCmd, { 'all.geojson': allFc });
  let estadosBuf = dissolvedOut['estados.geojson'];
  if (estadosBuf.byteLength > 1800 * 1024) {
    estadosBuf = await simplifyUnderLimit(estadosBuf, 1500 * 1024);
  }

  fs.writeFileSync(ESTADOS_OUT, estadosBuf);
  const estadosJsPath = ESTADOS_OUT.replace(/\.geojson$/i, '.js');
  fs.writeFileSync(
    estadosJsPath,
    `window.__CENET_GEO__=window.__CENET_GEO__||{};window.__CENET_GEO__["geo/mx_estados.geojson"]=${estadosBuf.toString('utf8')};\n`
  );
  console.log(`✓ Generado ${ESTADOS_OUT} -> ${(estadosBuf.byteLength / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
