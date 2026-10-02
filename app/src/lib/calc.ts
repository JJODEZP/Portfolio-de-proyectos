// Reglas de negocio: avance, semáforos, beneficios, ROI y payback.
// Todo puro (sin React) para poder testearlo y reutilizarlo en vistas SQL equivalentes.
import type { BeneficioMensual, Checkin, CostoMensual, Hito, Kpi, Proyecto, Salud } from './types';

export interface Periodo { anio: number; mes: number }

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const hoyISO = () => toISO(new Date());

/** Último mes con cierre contable: el mes anterior al actual. */
export function ultimoMesCerrado(now = new Date()): Periodo {
  const m = now.getMonth(); // 0-based → mes anterior en 1-based
  return m === 0 ? { anio: now.getFullYear() - 1, mes: 12 } : { anio: now.getFullYear(), mes: m };
}

export const periodoIdx = (p: Periodo) => p.anio * 12 + p.mes;

export function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

const pesoTotal = (hs: Hito[]) => hs.reduce((s, h) => s + (h.peso || 0), 0);

/** Avance real: % ponderado de hitos completados (o avance manual si no hay hitos). */
export function avanceProyecto(p: Proyecto, hitos: Hito[]): number {
  const hs = hitos.filter((h) => h.proyecto_id === p.id);
  const total = pesoTotal(hs);
  if (!total) return p.avance_manual;
  return Math.round((pesoTotal(hs.filter((h) => h.fecha_real)) / total) * 100);
}

/** Avance planificado a la fecha: % ponderado de hitos cuya fecha plan ya pasó. */
export function avanceEsperado(p: Proyecto, hitos: Hito[], hoy = hoyISO()): number {
  const hs = hitos.filter((h) => h.proyecto_id === p.id);
  const total = pesoTotal(hs);
  if (!total) {
    const dur = diasEntre(p.fecha_inicio, p.fecha_fin_plan);
    if (dur <= 0) return 100;
    return Math.round(Math.min(1, Math.max(0, diasEntre(p.fecha_inicio, hoy) / dur)) * 100);
  }
  return Math.round((pesoTotal(hs.filter((h) => h.fecha_plan <= hoy)) / total) * 100);
}

export function hitosAtrasados(p: Proyecto, hitos: Hito[], hoy = hoyISO()) {
  return hitos.filter((h) => h.proyecto_id === p.id && !h.fecha_real && h.fecha_plan < hoy);
}

/** Plazo: verde sin hitos vencidos; amarillo si el atraso máximo es ≤ 30 días; rojo si es mayor. */
export function saludPlazo(p: Proyecto, hitos: Hito[], hoy = hoyISO()): Salud {
  if (p.etapa === 'Cerrado') return 'verde';
  const atrasados = hitosAtrasados(p, hitos, hoy);
  if (!atrasados.length) {
    if (!p.fecha_fin_real && p.fecha_fin_plan < hoy && p.etapa !== 'Implementado') return 'amarillo';
    return 'verde';
  }
  const maxAtraso = Math.max(...atrasados.map((h) => diasEntre(h.fecha_plan, hoy)));
  return maxAtraso <= 30 ? 'amarillo' : 'rojo';
}

export interface Acumulado { plan: number; real: number }

/** Beneficio acumulado plan vs real hasta `hasta` inclusive (usar el último mes cerrado para comparar 1:1). */
export function beneficioAcumulado(proyectoId: string, bens: BeneficioMensual[], hasta: Periodo): Acumulado {
  const lim = periodoIdx(hasta);
  let plan = 0, real = 0;
  for (const b of bens) {
    if (b.proyecto_id !== proyectoId) continue;
    if (periodoIdx(b) > lim) continue;
    plan += b.ahorro_plan;
    if (b.ahorro_real != null) real += b.ahorro_real;
  }
  return { plan, real };
}

/** Beneficio: % de cumplimiento real vs plan; verde ≥ 95 %, amarillo ≥ 80 %, rojo < 80 %. */
export function saludBeneficio(acc: Acumulado): Salud | null {
  if (acc.plan <= 0) return null;
  const r = acc.real / acc.plan;
  return r >= 0.95 ? 'verde' : r >= 0.8 ? 'amarillo' : 'rojo';
}

const RANK: Record<Salud, number> = { verde: 0, amarillo: 1, rojo: 2 };
export const peorSalud = (xs: (Salud | null | undefined)[]): Salud =>
  xs.reduce<Salud>((w, s) => (s && RANK[s] > RANK[w] ? s : w), 'verde');

export function ultimoCheckin(proyectoId: string, checkins: Checkin[]): Checkin | undefined {
  let last: Checkin | undefined;
  for (const c of checkins) if (c.proyecto_id === proyectoId && (!last || c.fecha > last.fecha)) last = c;
  return last;
}

export interface Financiero {
  inversion: number;
  roiEsperado: number | null;   // % anual: ahorro comprometido / inversión
  paybackPlan: number | null;   // meses
  roiReal: number | null;       // % sobre lo realizado: (ahorro real acumulado − inversión) / inversión
  paybackReal: number | null;   // meses hasta recuperar la inversión con ahorro real (null si aún no)
  realTotal: number;
}

export function financiero(p: Proyecto, bens: BeneficioMensual[]): Financiero {
  const inversion = (p.inversion_capex || 0) + (p.inversion_opex || 0);
  const serie = bens
    .filter((b) => b.proyecto_id === p.id && b.ahorro_real != null)
    .sort((a, b) => periodoIdx(a) - periodoIdx(b));
  const realTotal = serie.reduce((s, b) => s + (b.ahorro_real ?? 0), 0);
  let paybackReal: number | null = null;
  if (inversion > 0) {
    let acc = 0;
    for (let i = 0; i < serie.length; i++) {
      acc += serie[i].ahorro_real ?? 0;
      if (acc >= inversion) { paybackReal = i + 1; break; }
    }
  }
  const anual = p.ahorro_comprometido_anual || 0;
  return {
    inversion,
    roiEsperado: inversion > 0 ? (anual / inversion) * 100 : null,
    paybackPlan: inversion > 0 && anual > 0 ? inversion / (anual / 12) : null,
    roiReal: inversion > 0 && serie.length ? ((realTotal - inversion) / inversion) * 100 : null,
    paybackReal,
    realTotal,
  };
}

/** Progreso de un KPI operativo desde la línea base hacia la meta (0–100+). */
export function progresoKpi(k: Kpi): number | null {
  if (k.actual == null || k.meta === k.linea_base) return null;
  return Math.round(((k.actual - k.linea_base) / (k.meta - k.linea_base)) * 100);
}

export interface AggCosto { presupuesto: number; real: number; estandar: number; desv: number; desvPct: number }

/** Suma costo real/presupuesto/estándar solo para meses con costo real (comparación homogénea). */
export function aggCostos(rows: CostoMensual[], f: { plantas?: string[]; clase?: string; anio: number; desde: number; hasta: number }): AggCosto {
  let presupuesto = 0, real = 0, estandar = 0;
  for (const c of rows) {
    if (c.anio !== f.anio || c.mes < f.desde || c.mes > f.hasta || c.costo_real == null) continue;
    if (f.plantas && !f.plantas.includes(c.planta_id)) continue;
    if (f.clase && c.clase_id !== f.clase) continue;
    presupuesto += c.presupuesto; real += c.costo_real; estandar += c.estandar;
  }
  const desv = real - presupuesto;
  return { presupuesto, real, estandar, desv, desvPct: presupuesto ? (desv / presupuesto) * 100 : 0 };
}

/** Umbrales del semáforo de desviación de costo (% sobre presupuesto). */
export function saludDesviacion(pct: number): Salud {
  return pct >= 3 ? 'rojo' : pct > 0.5 ? 'amarillo' : 'verde';
}

// ======================================================================
// Gestión de portafolio: probabilidad, valor ponderado, brecha, gates, priorización
// ======================================================================

/** Probabilidad estándar de capturar el ahorro según la etapa (práctica stage-gate). */
export const PROB_ETAPA: Record<Proyecto['etapa'], number> = {
  Idea: 20, 'Evaluación': 50, 'En ejecución': 80, Implementado: 95, Cerrado: 100,
};

export const probabilidad = (p: Proyecto) => p.probabilidad ?? PROB_ETAPA[p.etapa];

/** Ahorro anual ponderado por riesgo = comprometido × probabilidad. */
export const ahorroPonderado = (p: Proyecto) => (p.ahorro_comprometido_anual * probabilidad(p)) / 100;

/** Potencial de una oportunidad = costo base anual × % de mejora alcanzable. */
export const potencialOportunidad = (costoBase: number, mejoraPct: number) => Math.round((costoBase * mejoraPct) / 100);

/**
 * Brecha medida vs estándar, anualizada: (real − estándar) de los meses con cierre,
 * llevado a 12 meses. Positiva = estamos gastando sobre el estándar.
 */
export function brechaAnualizada(rows: CostoMensual[], f: { plantas?: string[]; clase?: string; anio: number }) {
  let dif = 0;
  const meses = new Set<number>();
  for (const c of rows) {
    if (c.anio !== f.anio || c.costo_real == null) continue;
    if (f.plantas && !f.plantas.includes(c.planta_id)) continue;
    if (f.clase && c.clase_id !== f.clase) continue;
    dif += c.costo_real - c.estandar;
    meses.add(c.mes);
  }
  return { anual: meses.size ? (dif * 12) / meses.size : 0, meses: meses.size, acumulada: dif };
}

export const COMPLEJIDAD_LABEL = ['', 'Muy baja', 'Baja', 'Media', 'Alta', 'Muy alta'];

export type Cuadrante = 'quick' | 'estrategico' | 'kaizen' | 'reconsiderar';
export const CUADRANTES: Record<Cuadrante, { titulo: string; accion: string }> = {
  quick: { titulo: 'Quick wins', accion: 'Alto valor, bajo esfuerzo: ejecutar primero' },
  estrategico: { titulo: 'Proyectos estratégicos', accion: 'Alto valor, alto esfuerzo: planificar y asignar recursos' },
  kaizen: { titulo: 'Mejoras rápidas', accion: 'Bajo valor, bajo esfuerzo: resolver con Kaizen en planta' },
  reconsiderar: { titulo: 'Reconsiderar', accion: 'Bajo valor, alto esfuerzo: rediseñar o descartar' },
};

/** Cuadrante valor-esfuerzo: valor alto = ponderado ≥ umbral (mediana del portafolio); esfuerzo alto = complejidad ≥ 4. */
export function cuadrante(p: Proyecto, umbralValor: number): Cuadrante {
  const alto = ahorroPonderado(p) >= umbralValor;
  const dificil = p.complejidad >= 4;
  return alto ? (dificil ? 'estrategico' : 'quick') : (dificil ? 'reconsiderar' : 'kaizen');
}

/** Puntaje de priorización = ahorro ponderado ÷ complejidad (MM/año por punto de esfuerzo). */
export const puntaje = (p: Proyecto) => ahorroPonderado(p) / Math.max(1, p.complejidad);

export function mediana(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface Criterio { label: string; ok: boolean; ayuda: string }

/** Criterios para pasar el gate hacia la siguiente etapa (o null si ya está cerrado). */
export function criteriosGate(
  p: Proyecto,
  d: { hitos: Hito[]; kpis: Kpi[]; beneficios: BeneficioMensual[]; acciones: { proyecto_id: string | null; estado: string }[] },
  cierre: Periodo = ultimoMesCerrado(),
): { destino: Proyecto['etapa']; criterios: Criterio[] } | null {
  const hs = d.hitos.filter((h) => h.proyecto_id === p.id);
  const bs = d.beneficios.filter((b) => b.proyecto_id === p.id);
  const reales = bs.filter((b) => b.ahorro_real != null);
  switch (p.etapa) {
    case 'Idea':
      return { destino: 'Evaluación', criterios: [
        { label: 'Descripción del objetivo', ok: p.descripcion.trim().length >= 10, ayuda: 'Qué problema resuelve y cómo (mín. 10 caracteres).' },
        { label: 'Ahorro anual estimado', ok: p.ahorro_comprometido_anual > 0, ayuda: 'Orden de magnitud del beneficio en MM/año.' },
        { label: 'Líder asignado', ok: !!p.lider_id, ayuda: 'Una persona responsable.' },
      ] };
    case 'Evaluación':
      return { destino: 'En ejecución', criterios: [
        { label: 'Línea base medible', ok: p.linea_base.trim().length >= 5, ayuda: 'Situación inicial con número y período (ej: merma 1,9 % prom. 6 meses).' },
        { label: 'Sponsor definido', ok: p.sponsor.trim().length > 0, ayuda: 'Quien patrocina y destraba recursos.' },
        { label: 'Plan con al menos 3 hitos', ok: hs.length >= 3, ayuda: 'Hitos con fecha y peso para medir avance.' },
        { label: 'KPI operativo definido', ok: d.kpis.some((k) => k.proyecto_id === p.id), ayuda: 'Indicador con línea base y meta.' },
        { label: 'Curva plan de ahorro', ok: bs.length > 0, ayuda: 'Ahorro esperado mes a mes («Generar curva plan»).' },
        { label: 'Aprobado por jefe de planta o Control de Gestión', ok: p.aprobado, ayuda: 'Gate formal de inversión.' },
      ] };
    case 'En ejecución':
      return { destino: 'Implementado', criterios: [
        { label: 'Todos los hitos completados', ok: hs.length > 0 && hs.every((h) => h.fecha_real), ayuda: 'El plan se ejecutó completo.' },
        { label: 'Ahorro real registrado', ok: reales.length >= 1, ayuda: 'Al menos un mes con ahorro logrado medido.' },
      ] };
    case 'Implementado': {
      const plan = bs.filter((b) => b.ahorro_real != null && periodoIdx(b) <= periodoIdx(cierre)).reduce((s, b) => s + b.ahorro_plan, 0);
      const real = reales.reduce((s, b) => s + (b.ahorro_real ?? 0), 0);
      return { destino: 'Cerrado', criterios: [
        { label: '3 meses de ahorro medido', ok: reales.length >= 3, ayuda: 'Demuestra que el beneficio es sostenible.' },
        { label: 'Logrado ≥ 80 % de lo esperado', ok: plan > 0 && real / plan >= 0.8, ayuda: 'Beneficio validado contra la curva plan.' },
        { label: 'Sin acciones abiertas', ok: !d.acciones.some((a) => a.proyecto_id === p.id && a.estado !== 'Hecha'), ayuda: 'Todo el plan de acción cerrado.' },
      ] };
    }
    default:
      return null;
  }
}
