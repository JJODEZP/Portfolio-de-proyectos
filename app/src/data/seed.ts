// Datos de demostración (ficticios), generados relativos a la fecha actual
// para que el demo siempre muestre un año en curso con meses cerrados.
import { toISO, ultimoMesCerrado } from '../lib/calc';
import type {
  Accion, BeneficioMensual, CausaRaiz, Checkin, ClaseCosto, CostoMensual, Etapa, Hito, Kpi, Oportunidad,
  Perfil, Planta, Proyecto, Replicacion, Salud, Tables, TipoBeneficio, TipoProyecto,
} from '../lib/types';

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (v: number) => Math.round(v * 10) / 10;

export const CLASES: ClaseCosto[] = [
  { id: 'rend', nombre: 'Rendimiento', descripcion: 'Rendimiento de canal y despiece, giveaway de peso' },
  { id: 'mo', nombre: 'Mano de obra', descripcion: 'MO directa, horas extra y contratistas' },
  { id: 'ins', nombre: 'Insumos', descripcion: 'Envases, films, químicos, aditivos' },
  { id: 'mer', nombre: 'Mermas', descripcion: 'Merma de proceso, reproceso, merma en cámaras' },
  { id: 'ene', nombre: 'Energía', descripcion: 'Electricidad, gas/vapor, agua y efluentes' },
];

export function buildSeed(now = new Date()): Tables {
  const rand = rng(20261002);
  const cierre = ultimoMesCerrado(now);
  const anio = now.getFullYear();
  const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() + offset); return toISO(d); };
  const monthsFromNow = (m: number, dia = 15) => toISO(new Date(now.getFullYear(), now.getMonth() + m, dia));

  const plantas: Planta[] = [
    { id: 'pl-lm', nombre: 'Lo Miranda', meta_ahorro_anual: 1400 },
    { id: 'pl-ro', nombre: 'Rosario', meta_ahorro_anual: 450 },
    { id: 'pl-vc', nombre: 'Valle Central', meta_ahorro_anual: 320 },
  ];

  const perfiles: Perfil[] = [
    { id: 'u-cg', nombre: 'Ana Torres', email: 'ana.torres@demo.cl', rol: 'admin', planta_id: null },
    { id: 'u-ge', nombre: 'Rodrigo Silva', email: 'rodrigo.silva@demo.cl', rol: 'gerencia', planta_id: null },
    { id: 'u-jlm', nombre: 'Carla Muñoz', email: 'carla.munoz@demo.cl', rol: 'jefe_planta', planta_id: 'pl-lm' },
    { id: 'u-jro', nombre: 'Felipe Reyes', email: 'felipe.reyes@demo.cl', rol: 'jefe_planta', planta_id: 'pl-ro' },
    { id: 'u-jvc', nombre: 'Daniela Paz', email: 'daniela.paz@demo.cl', rol: 'jefe_planta', planta_id: 'pl-vc' },
    { id: 'u-soto', nombre: 'Jorge Soto', email: 'jorge.soto@demo.cl', rol: 'lider', planta_id: 'pl-lm' },
    { id: 'u-perez', nombre: 'María Pérez', email: 'maria.perez@demo.cl', rol: 'lider', planta_id: 'pl-lm' },
    { id: 'u-rojas', nombre: 'Claudio Rojas', email: 'claudio.rojas@demo.cl', rol: 'lider', planta_id: 'pl-lm' },
    { id: 'u-nunez', nombre: 'Pablo Núñez', email: 'pablo.nunez@demo.cl', rol: 'lider', planta_id: 'pl-lm' },
    { id: 'u-diaz', nombre: 'Andrea Díaz', email: 'andrea.diaz@demo.cl', rol: 'lider', planta_id: 'pl-ro' },
    { id: 'u-fuentes', nombre: 'Sebastián Fuentes', email: 'sebastian.fuentes@demo.cl', rol: 'lider', planta_id: 'pl-ro' },
    { id: 'u-araya', nombre: 'Rocío Araya', email: 'rocio.araya@demo.cl', rol: 'lider', planta_id: 'pl-vc' },
  ];

  const oportunidades: Oportunidad[] = [
    { id: 'op-1', clase_id: 'mo', nombre: 'Horas extra y gestión de turnos', potencial: 320 },
    { id: 'op-2', clase_id: 'mo', nombre: 'Productividad y balanceo de línea', potencial: 360 },
    { id: 'op-3', clase_id: 'rend', nombre: 'Rendimiento de despiece', potencial: 460 },
    { id: 'op-4', clase_id: 'rend', nombre: 'Precisión de pesaje y giveaway', potencial: 160 },
    { id: 'op-5', clase_id: 'ins', nombre: 'Consumo de envases y films', potencial: 210 },
    { id: 'op-6', clase_id: 'ins', nombre: 'Costo unitario de químicos', potencial: 170 },
    { id: 'op-7', clase_id: 'mer', nombre: 'Merma de proceso y reproceso', potencial: 260 },
    { id: 'op-8', clase_id: 'mer', nombre: 'Merma por frío y logística', potencial: 150 },
    { id: 'op-9', clase_id: 'ene', nombre: 'Eficiencia eléctrica y refrigeración', potencial: 320 },
    { id: 'op-10', clase_id: 'ene', nombre: 'Vapor, condensados y agua', potencial: 240 },
  ];

  // ---------- Proyectos ----------
  interface Def {
    nombre: string; tipo: TipoProyecto; etapa: Etapa; planta: string; clase: string; op: string; lider: string;
    sponsor: string; ahorro: number; inicio: number; dur: number; desempeno: number; atraso?: number;
    capex: number; opex: number; benef: TipoBeneficio; base: string;
    kpi: [string, string, number, number, number | null, 'menor' | 'mayor'];
    hitos: string[]; rep?: [string, Replicacion['estado']][]; desc: string;
  }
  // inicio y dur en meses relativos a hoy; desempeno = real/plan del beneficio; atraso = días de atraso del hito en curso
  const defs: Def[] = [
    { nombre: 'Reducción de horas extra en deshuese', tipo: 'Kaizen', etapa: 'Implementado', planta: 'pl-lm', clase: 'mo', op: 'op-1', lider: 'u-soto', sponsor: 'Carla Muñoz', ahorro: 180, inicio: -8, dur: 5, desempeno: 1.04, capex: 0, opex: 12, benef: 'Ahorro duro', base: 'Promedio 2.150 HH extra/mes en deshuese (ene–mar)', kpi: ['Horas extra deshuese', 'HH/mes', 2150, 1300, 1380, 'menor'], hitos: ['Diagnóstico VSM', 'Rediseño de turnos', 'Piloto línea 1', 'Estandarización', 'Cierre y control'], rep: [['pl-ro', 'Replicado'], ['pl-vc', 'Potencial']], desc: 'Rediseño de turnos y polivalencia para reducir horas extra estructurales en deshuese.' },
    { nombre: 'Optimización de rendimiento en despiece', tipo: 'Proyecto', etapa: 'En ejecución', planta: 'pl-lm', clase: 'rend', op: 'op-3', lider: 'u-perez', sponsor: 'Carla Muñoz', ahorro: 340, inicio: -6, dur: 9, desempeno: 0.78, atraso: 21, capex: 145, opex: 20, benef: 'Ahorro duro', base: 'Rendimiento despiece 71,8 % (prom. 6 meses)', kpi: ['Rendimiento despiece', '%', 71.8, 73.2, 72.4, 'mayor'], hitos: ['Línea base y medición', 'Capacitación de operadores', 'Ajuste de especificaciones', 'Nuevos cuchillos y afilado', 'Estabilización', 'Cierre'], rep: [['pl-ro', 'Potencial']], desc: 'Reducir pérdidas de yield en despiece mediante estándar de corte, capacitación y control estadístico.' },
    { nombre: 'Recuperación de condensados de caldera', tipo: 'Reducción de costo', etapa: 'Implementado', planta: 'pl-lm', clase: 'ene', op: 'op-10', lider: 'u-rojas', sponsor: 'Carla Muñoz', ahorro: 150, inicio: -10, dur: 6, desempeno: 0.97, capex: 210, opex: 8, benef: 'Ahorro duro', base: 'Consumo gas 412.000 m³/mes', kpi: ['Consumo de gas', 'm³/mes', 412000, 370000, 376000, 'menor'], hitos: ['Ingeniería', 'Compra equipos', 'Montaje', 'Puesta en marcha'], rep: [['pl-ro', 'En curso'], ['pl-vc', 'Potencial']], desc: 'Retorno de condensados al estanque de alimentación para reducir consumo de gas.' },
    { nombre: 'Variadores de frecuencia en refrigeración', tipo: 'Proyecto', etapa: 'En ejecución', planta: 'pl-lm', clase: 'ene', op: 'op-9', lider: 'u-rojas', sponsor: 'Carla Muñoz', ahorro: 220, inicio: -4, dur: 8, desempeno: 0.92, capex: 260, opex: 15, benef: 'Ahorro duro', base: '1,92 GWh/mes en sala de máquinas', kpi: ['Consumo sala de máquinas', 'MWh/mes', 1920, 1680, 1790, 'menor'], hitos: ['Auditoría energética', 'Licitación', 'Instalación VDF compresores 1-3', 'Instalación VDF compresores 4-6', 'Medición y verificación'], desc: 'Instalación de VDF en compresores y condensadores evaporativos.' },
    { nombre: 'Estandarización de uso de film y envases', tipo: 'Kaizen', etapa: 'Cerrado', planta: 'pl-ro', clase: 'ins', op: 'op-5', lider: 'u-diaz', sponsor: 'Felipe Reyes', ahorro: 95, inicio: -11, dur: 4, desempeno: 1.08, capex: 0, opex: 4, benef: 'Ahorro duro', base: '18,4 g film por bandeja', kpi: ['Film por bandeja', 'g', 18.4, 16.5, 16.2, 'menor'], hitos: ['Gemba y medición', 'Ajuste de selladoras', 'Estándar de trabajo', 'Cierre'], rep: [['pl-vc', 'Replicado'], ['pl-lm', 'En curso']], desc: 'Ajuste de selladoras y estándar de trabajo para reducir consumo de film.' },
    { nombre: 'Renegociación de químicos de sanitización', tipo: 'Reducción de costo', etapa: 'Evaluación', planta: 'pl-lm', clase: 'ins', op: 'op-6', lider: 'u-perez', sponsor: 'Ana Torres', ahorro: 130, inicio: -1, dur: 5, desempeno: 0, capex: 0, opex: 0, benef: 'Ahorro duro', base: 'Costo químicos 21 MM/mes', kpi: ['Costo químicos', 'MM/mes', 21, 17.5, 21, 'menor'], hitos: ['Levantamiento de consumos', 'RFP a proveedores', 'Pruebas de eficacia', 'Adjudicación'], desc: 'Licitación consolidada y reformulación de dosificaciones.' },
    { nombre: 'Reducción de merma en línea de empaque', tipo: 'Kaizen', etapa: 'En ejecución', planta: 'pl-lm', clase: 'mer', op: 'op-7', lider: 'u-nunez', sponsor: 'Carla Muñoz', ahorro: 160, inicio: -5, dur: 6, desempeno: 0.71, atraso: 45, capex: 35, opex: 6, benef: 'Ahorro duro', base: 'Merma empaque 1,9 %', kpi: ['Merma en empaque', '%', 1.9, 1.2, 1.6, 'menor'], hitos: ['Análisis de Pareto', 'Causa raíz (Ishikawa)', 'Contramedidas', 'Estandarización'], desc: 'Kaizen sobre las 3 principales causas de merma en empaque.' },
    { nombre: 'Reproceso por mal sellado', tipo: 'Kaizen', etapa: 'Idea', planta: 'pl-vc', clase: 'mer', op: 'op-7', lider: 'u-araya', sponsor: 'Daniela Paz', ahorro: 70, inicio: 1, dur: 4, desempeno: 0, capex: 0, opex: 3, benef: 'Ahorro duro', base: 'Reproceso 0,8 % de bandejas', kpi: ['Reproceso por sellado', '%', 0.8, 0.3, null, 'menor'], hitos: ['Medición', 'Ajuste de mordazas', 'Estándar'], desc: 'Reducir reprocesos por fallas de sellado.' },
    { nombre: 'Balanceo de línea de faena', tipo: 'Kaizen', etapa: 'Evaluación', planta: 'pl-lm', clase: 'mo', op: 'op-2', lider: 'u-soto', sponsor: 'Carla Muñoz', ahorro: 170, inicio: -1, dur: 6, desempeno: 0, capex: 20, opex: 5, benef: 'Ahorro duro', base: '0,42 HH por cabeza', kpi: ['HH por cabeza', 'HH', 0.42, 0.37, 0.42, 'menor'], hitos: ['Toma de tiempos', 'Balanceo propuesto', 'Piloto', 'Implementación'], desc: 'Balanceo de estaciones para reducir dotación por turno.' },
    { nombre: 'Plan de turnos y reemplazos por ausentismo', tipo: 'Proyecto', etapa: 'En ejecución', planta: 'pl-ro', clase: 'mo', op: 'op-1', lider: 'u-fuentes', sponsor: 'Felipe Reyes', ahorro: 125, inicio: -5, dur: 7, desempeno: 0.88, capex: 0, opex: 10, benef: 'Ahorro duro', base: 'Ausentismo 7,9 % · 1.100 HH extra/mes', kpi: ['Ausentismo', '%', 7.9, 5.5, 6.6, 'menor'], hitos: ['Diagnóstico con RR.HH.', 'Pool de polivalentes', 'Nuevo sistema de turnos', 'Seguimiento'], desc: 'Pool de operadores polivalentes y gestión de ausentismo.' },
    { nombre: 'Control de consumo de agua en lavado', tipo: 'Kaizen', etapa: 'Idea', planta: 'pl-ro', clase: 'ene', op: 'op-10', lider: 'u-fuentes', sponsor: 'Felipe Reyes', ahorro: 60, inicio: 1, dur: 4, desempeno: 0, capex: 15, opex: 2, benef: 'Ahorro duro', base: '6,1 m³ de agua por tonelada', kpi: ['Agua por tonelada', 'm³/t', 6.1, 5.2, null, 'menor'], hitos: ['Medición por sector', 'Boquillas y válvulas', 'Estándar de lavado'], desc: 'Reducción de agua en sanitización con boquillas y estándares.' },
    { nombre: 'Merma por tiempos de espera en cámaras', tipo: 'Proyecto', etapa: 'En ejecución', planta: 'pl-lm', clase: 'mer', op: 'op-8', lider: 'u-nunez', sponsor: 'Carla Muñoz', ahorro: 115, inicio: -3, dur: 6, desempeno: 0.83, capex: 40, opex: 6, benef: 'Ahorro duro', base: 'Pérdida de peso 0,65 % en cámaras', kpi: ['Pérdida de peso en cámara', '%', 0.65, 0.4, 0.55, 'menor'], hitos: ['Mapeo de tiempos', 'Regla FIFO y alertas', 'Ajuste de humedad', 'Cierre'], desc: 'Reducir pérdida de peso por tiempos de espera > 36 h.' },
    { nombre: 'Calibración de balanzas y control de giveaway', tipo: 'Kaizen', etapa: 'Implementado', planta: 'pl-lm', clase: 'rend', op: 'op-4', lider: 'u-perez', sponsor: 'Carla Muñoz', ahorro: 85, inicio: -9, dur: 4, desempeno: 1.1, capex: 18, opex: 3, benef: 'Ahorro duro', base: 'Giveaway 2,3 % sobre peso declarado', kpi: ['Giveaway', '%', 2.3, 1.2, 1.1, 'menor'], hitos: ['Auditoría de balanzas', 'Calibración', 'Control SPC', 'Cierre'], rep: [['pl-ro', 'Replicado'], ['pl-vc', 'Replicado']], desc: 'Control estadístico de peso para reducir producto regalado.' },
    { nombre: 'Estandarización de corte en línea 2', tipo: 'Kaizen', etapa: 'En ejecución', planta: 'pl-vc', clase: 'rend', op: 'op-3', lider: 'u-araya', sponsor: 'Daniela Paz', ahorro: 75, inicio: -3, dur: 5, desempeno: 1.0, capex: 5, opex: 3, benef: 'Ahorro duro', base: 'Rendimiento línea 2: 70,9 %', kpi: ['Rendimiento línea 2', '%', 70.9, 72, 71.6, 'mayor'], hitos: ['Medición', 'Estándar de corte', 'Capacitación', 'Auditorías'], desc: 'Estándar visual de corte y auditorías por turno.' },
    { nombre: 'Mantenimiento autónomo en túneles de frío', tipo: 'Proyecto', etapa: 'En ejecución', planta: 'pl-vc', clase: 'ene', op: 'op-9', lider: 'u-araya', sponsor: 'Daniela Paz', ahorro: 90, inicio: -2, dur: 6, desempeno: 0.9, capex: 12, opex: 6, benef: 'Costo evitado', base: '14 detenciones/mes por escarcha', kpi: ['Detenciones por escarcha', 'eventos/mes', 14, 4, 9, 'menor'], hitos: ['Limpieza inicial', 'Estándares TPM', 'Auditorías', 'Cierre'], desc: 'TPM para evitar detenciones y sobreconsumo en túneles.' },
  ];

  const proyectos: Proyecto[] = [];
  const hitos: Hito[] = [];
  const beneficios: BeneficioMensual[] = [];
  const kpis: Kpi[] = [];
  const checkins: Checkin[] = [];
  const replicaciones: Replicacion[] = [];
  const hoy = toISO(now);
  const avanceEtapa: Record<Etapa, number> = { Idea: 0, Evaluación: 0.2, 'En ejecución': 0.55, Implementado: 1, Cerrado: 1 };

  defs.forEach((d, i) => {
    const id = `pr-${String(i + 1).padStart(2, '0')}`;
    const inicio = monthsFromNow(d.inicio, 1 + (i % 10));
    const fin = monthsFromNow(d.inicio + d.dur, 1 + (i % 10));
    const terminado = d.etapa === 'Implementado' || d.etapa === 'Cerrado';
    const aprobado = d.etapa !== 'Idea';
    proyectos.push({
      id, codigo: `PE-${anio}-${String(i + 1).padStart(3, '0')}`, nombre: d.nombre, descripcion: d.desc, tipo: d.tipo, etapa: d.etapa,
      planta_id: d.planta, clase_id: d.clase, oportunidad_id: d.op, lider_id: d.lider, sponsor: d.sponsor,
      fecha_inicio: inicio, fecha_fin_plan: fin, fecha_fin_real: terminado ? fin : null, avance_manual: 0,
      linea_base: d.base, tipo_beneficio: d.benef, ahorro_comprometido_anual: d.ahorro,
      inversion_capex: d.capex, inversion_opex: d.opex,
      aprobado, aprobado_por: aprobado ? (perfiles.find((p) => p.planta_id === d.planta && p.rol === 'jefe_planta')?.id ?? null) : null,
      aprobado_en: aprobado ? inicio : null,
    });

    // Hitos repartidos entre inicio y fin; se completan según la etapa
    const n = d.hitos.length;
    const t0 = Date.parse(inicio), t1 = Date.parse(fin);
    const completos = terminado ? n : Math.round(n * avanceEtapa[d.etapa]);
    d.hitos.forEach((nombre, k) => {
      const plan = toISO(new Date(t0 + ((t1 - t0) * (k + 1)) / n));
      let real: string | null = null;
      if (k < completos) {
        const desfase = Math.round((rand() - 0.4) * 12);
        real = toISO(new Date(Date.parse(plan) + desfase * 86_400_000));
        if (real > hoy) real = hoy;
      }
      // El hito en curso de proyectos atrasados queda con su fecha plan ya vencida
      const fechaPlan = !real && d.atraso && k === completos ? day(-d.atraso) : plan;
      hitos.push({ id: `hi-${id}-${k}`, proyecto_id: id, nombre, fecha_plan: fechaPlan, fecha_real: real, peso: k === n - 1 ? 10 : 20 });
    });

    // Curva de beneficio: comienza a ~55 % del plazo y se estabiliza en 3 meses (rampa 40/70/100 %)
    const mensual = d.ahorro / 12;
    const inicioBenef = new Date(now.getFullYear(), now.getMonth() + d.inicio + Math.max(1, Math.round(d.dur * 0.55)), 1);
    if (d.etapa !== 'Idea' && d.etapa !== 'Evaluación') {
      for (let k = 0; k < 18; k++) {
        const fecha = new Date(inicioBenef.getFullYear(), inicioBenef.getMonth() + k, 1);
        if (fecha.getFullYear() > anio) break;
        const a = fecha.getFullYear(), m = fecha.getMonth() + 1;
        const plan = r1(mensual * ([0.4, 0.7][k] ?? 1));
        const cerrado = a * 12 + m <= cierre.anio * 12 + cierre.mes;
        const real = cerrado ? r1(plan * d.desempeno * (0.9 + rand() * 0.2)) : null;
        beneficios.push({ id: `be-${id}-${a}-${m}`, proyecto_id: id, anio: a, mes: m, ahorro_plan: plan, ahorro_real: real });
      }
    }

    const [kn, ku, kb, km, ka, ks] = d.kpi;
    kpis.push({ id: `kp-${id}`, proyecto_id: id, nombre: kn, unidad: ku, linea_base: kb, meta: km, actual: ka, sentido: ks });

    for (const [pl, estado] of d.rep ?? []) replicaciones.push({ id: `re-${id}-${pl}`, proyecto_id: id, planta_id: pl, estado });

    // Check-ins quincenales de los últimos 2 meses en proyectos activos
    if (d.etapa !== 'Idea') {
      const salud: Salud = d.desempeno && d.desempeno < 0.8 ? 'rojo' : (d.atraso ?? 0) > 0 || (d.desempeno && d.desempeno < 0.95) ? 'amarillo' : 'verde';
      const avanceFinal = terminado ? 100 : Math.round((completos / n) * 90);
      const comentarios: Record<Salud, string[]> = {
        verde: ['Avance según plan, sin bloqueos.', 'Hitos del período cumplidos; beneficio en línea con la curva comprometida.'],
        amarillo: ['Avance con leve atraso; se reprogramó la siguiente actividad.', 'Beneficio bajo la curva comprometida, se refuerza el seguimiento en terreno.'],
        rojo: ['Beneficio real bajo 80 % del plan; se escala a jefatura de planta.', 'Atraso en hito crítico; requiere apoyo de mantención.'],
      };
      for (let k = 3; k >= 0; k--) {
        const fecha = day(-k * 14 - (i % 5));
        if (fecha < inicio) continue;
        const s: Salud = k > 1 && salud === 'rojo' ? 'amarillo' : salud;
        checkins.push({
          id: `ck-${id}-${k}`, proyecto_id: id, fecha, autor_id: d.lider,
          avance: Math.max(0, avanceFinal - k * 8), salud: s,
          comentario: comentarios[s][k % 2],
          riesgos: s === 'verde' ? '' : s === 'amarillo' ? 'Disponibilidad de personal clave en temporada alta.' : 'Proveedor con atraso en entrega; impacto en curva de ahorro.',
          proximos_pasos: d.hitos[Math.min(completos, n - 1)] ? `Avanzar en: ${d.hitos[Math.min(completos, n - 1)]}` : '',
        });
      }
    }
  });

  // ---------- Costos mensuales (presupuesto / real / estándar) ----------
  const BASE: Record<string, number> = { rend: 420, mo: 610, ins: 520, mer: 180, ene: 260 };
  const PBASE: Record<string, number> = { 'pl-lm': 1, 'pl-ro': 0.55, 'pl-vc': 0.4 };
  const SEAS = [0.95, 0.92, 1, 1, 1.02, 1, 1.03, 1.04, 1, 1.05, 1.08, 1.1];
  const TREND = [0.5, 0.6, 0.8, 0.9, 1.1, 1.3, 1.4, 1.2, 1, 0.9, 0.9, 0.9];
  const BIAS: Record<string, number> = { rend: 0.025, mo: 0.04, ins: 0.015, mer: 0.09, ene: -0.015 };
  const PB: Record<string, Record<string, number>> = { 'pl-lm': { mo: 0.015, mer: 0.02 }, 'pl-ro': { ene: 0.02, rend: 0.01 }, 'pl-vc': { ins: -0.01 } };
  const costos: CostoMensual[] = [];
  const mesCierreAnio = cierre.anio === anio ? cierre.mes : 0;
  for (const p of plantas) for (const c of CLASES) for (let m = 1; m <= 12; m++) {
    const ppto = BASE[c.id] * PBASE[p.id] * SEAS[m - 1] * (1 + (rand() - 0.5) * 0.01);
    const real = m <= mesCierreAnio
      ? ppto * (1 + (BIAS[c.id] + (PB[p.id][c.id] ?? 0)) * TREND[m - 1] + (rand() - 0.5) * 0.02)
      : null;
    costos.push({ id: `co-${p.id}-${c.id}-${anio}-${m}`, planta_id: p.id, clase_id: c.id, anio, mes: m, presupuesto: r1(ppto), costo_real: real == null ? null : r1(real), estandar: r1(ppto * 0.985) });
  }

  const mesC = (k: number) => Math.max(1, (mesCierreAnio || 1) - k);
  const causas: CausaRaiz[] = [
    { id: 'ca-1', planta_id: 'pl-lm', clase_id: 'mer', anio, mes: mesC(2), impacto: 18.4, causa: 'Pérdida de peso en cámaras por tiempos de espera > 36 h', tipo_causa: 'Planificación', estado: 'En plan' },
    { id: 'ca-2', planta_id: 'pl-lm', clase_id: 'mo', anio, mes: mesC(3), impacto: 22.0, causa: 'Horas extra por ausentismo en turno B', tipo_causa: 'Personas', estado: 'En plan' },
    { id: 'ca-3', planta_id: 'pl-ro', clase_id: 'ene', anio, mes: mesC(1), impacto: 9.5, causa: 'Consumo base de refrigeración fuera de estándar por falla de control de temperatura', tipo_causa: 'Mantención', estado: 'Abierta' },
    { id: 'ca-4', planta_id: 'pl-lm', clase_id: 'rend', anio, mes: mesC(2), impacto: 31.0, causa: 'Cortes fuera de especificación en línea 2', tipo_causa: 'Operación', estado: 'En plan' },
    { id: 'ca-5', planta_id: 'pl-vc', clase_id: 'ins', anio, mes: mesC(1), impacto: 6.2, causa: 'Alza de precio del film y consumo sobre estándar', tipo_causa: 'Proveedor / Precio', estado: 'Abierta' },
    { id: 'ca-6', planta_id: 'pl-ro', clase_id: 'mo', anio, mes: mesC(0), impacto: 7.8, causa: 'Rotación de personal en empaque reduce productividad', tipo_causa: 'Personas', estado: 'Abierta' },
    { id: 'ca-7', planta_id: 'pl-vc', clase_id: 'mer', anio, mes: mesC(4), impacto: 4.1, causa: 'Reproceso por mal sellado', tipo_causa: 'Calidad', estado: 'Cerrada' },
  ];

  const acciones: Accion[] = [
    { id: 'ac-1', descripcion: 'Implementar control de tiempos de espera pre-faena con alertas', responsable_id: 'u-nunez', fecha_vencimiento: day(-7), estado: 'En curso', proyecto_id: null, causa_id: 'ca-1' },
    { id: 'ac-2', descripcion: 'Plan de turnos y reemplazos con RR.HH.', responsable_id: 'u-soto', fecha_vencimiento: day(8), estado: 'En curso', proyecto_id: null, causa_id: 'ca-2' },
    { id: 'ac-3', descripcion: 'Recalibrar balanzas línea 2 y auditar semanalmente', responsable_id: 'u-perez', fecha_vencimiento: day(-14), estado: 'Hecha', proyecto_id: 'pr-13', causa_id: null },
    { id: 'ac-4', descripcion: 'Revisión del sistema de control de temperatura', responsable_id: 'u-jro', fecha_vencimiento: day(13), estado: 'Pendiente', proyecto_id: null, causa_id: 'ca-3' },
    { id: 'ac-5', descripcion: 'Cotizar 3 proveedores alternativos de film', responsable_id: 'u-araya', fecha_vencimiento: day(3), estado: 'Pendiente', proyecto_id: null, causa_id: 'ca-5' },
    { id: 'ac-6', descripcion: 'Medición y verificación de ahorro VDF (30 días)', responsable_id: 'u-rojas', fecha_vencimiento: day(28), estado: 'Pendiente', proyecto_id: 'pr-04', causa_id: null },
    { id: 'ac-7', descripcion: 'Documentar estándar de merma en empaque', responsable_id: 'u-nunez', fecha_vencimiento: day(-4), estado: 'En curso', proyecto_id: 'pr-07', causa_id: null },
    { id: 'ac-8', descripcion: 'Presentar caso de replicabilidad de condensados a Rosario', responsable_id: 'u-rojas', fecha_vencimiento: day(34), estado: 'Pendiente', proyecto_id: 'pr-03', causa_id: null },
    { id: 'ac-9', descripcion: 'Reforzar capacitación de corte con proveedor de cuchillos', responsable_id: 'u-perez', fecha_vencimiento: day(-10), estado: 'Pendiente', proyecto_id: 'pr-02', causa_id: null },
    { id: 'ac-10', descripcion: 'Actualizar estructura de clases de costo para el presupuesto', responsable_id: 'u-cg', fecha_vencimiento: day(18), estado: 'Pendiente', proyecto_id: null, causa_id: null },
    { id: 'ac-11', descripcion: 'Plan de retención en empaque con RR.HH.', responsable_id: 'u-fuentes', fecha_vencimiento: day(20), estado: 'Pendiente', proyecto_id: null, causa_id: 'ca-6' },
  ];

  return {
    plantas, perfiles, clases_costo: CLASES, oportunidades, proyectos, hitos, checkins,
    beneficios_mensuales: beneficios, kpis, replicaciones, costos_mensuales: costos, causas_raiz: causas, acciones,
  };
}
