import { describe, expect, it } from 'vitest';
import {
  aggCostos, avanceEsperado, avanceProyecto, beneficioAcumulado, financiero, peorSalud, progresoKpi,
  saludBeneficio, saludDesviacion, saludPlazo, ultimoMesCerrado,
} from './calc';
import type { BeneficioMensual, Hito, Proyecto } from './types';

const p = {
  id: 'p1', etapa: 'En ejecución', fecha_inicio: '2026-01-01', fecha_fin_plan: '2026-12-31', fecha_fin_real: null,
  avance_manual: 30, ahorro_comprometido_anual: 120, inversion_capex: 50, inversion_opex: 10,
} as Proyecto;
const hito = (id: string, plan: string, real: string | null, peso: number): Hito =>
  ({ id, proyecto_id: 'p1', nombre: id, fecha_plan: plan, fecha_real: real, peso });
const ben = (mes: number, plan: number, real: number | null): BeneficioMensual =>
  ({ id: `b${mes}`, proyecto_id: 'p1', anio: 2026, mes, ahorro_plan: plan, ahorro_real: real });

describe('avance', () => {
  const hs = [hito('a', '2026-02-01', '2026-02-03', 20), hito('b', '2026-05-01', null, 30), hito('c', '2026-09-01', null, 50)];
  it('pondera hitos completados', () => expect(avanceProyecto(p, hs)).toBe(20));
  it('usa avance manual sin hitos', () => expect(avanceProyecto(p, [])).toBe(30));
  it('plan = hitos con fecha vencida', () => expect(avanceEsperado(p, hs, '2026-06-01')).toBe(50));
  it('plan lineal sin hitos', () => expect(avanceEsperado(p, [], '2026-07-02')).toBe(50));
});

describe('salud de plazo', () => {
  it('verde sin atrasos', () => expect(saludPlazo(p, [hito('a', '2026-08-01', null, 1)], '2026-07-01')).toBe('verde'));
  it('amarillo con atraso ≤ 30 d', () => expect(saludPlazo(p, [hito('a', '2026-06-20', null, 1)], '2026-07-01')).toBe('amarillo'));
  it('rojo con atraso > 30 d', () => expect(saludPlazo(p, [hito('a', '2026-05-01', null, 1)], '2026-07-01')).toBe('rojo'));
  it('cerrado siempre verde', () => expect(saludPlazo({ ...p, etapa: 'Cerrado' }, [hito('a', '2026-01-01', null, 1)], '2026-07-01')).toBe('verde'));
});

describe('beneficios', () => {
  const bs = [ben(1, 10, 9), ben(2, 10, 8), ben(3, 10, null), ben(4, 10, null)];
  it('acumula hasta el mes de cierre', () => expect(beneficioAcumulado('p1', bs, { anio: 2026, mes: 2 })).toEqual({ plan: 20, real: 17 }));
  it('semáforo de beneficio', () => {
    expect(saludBeneficio({ plan: 20, real: 19 })).toBe('verde');
    expect(saludBeneficio({ plan: 20, real: 17 })).toBe('amarillo');
    expect(saludBeneficio({ plan: 20, real: 10 })).toBe('rojo');
    expect(saludBeneficio({ plan: 0, real: 0 })).toBeNull();
  });
  it('peor salud', () => expect(peorSalud(['verde', null, 'amarillo', undefined])).toBe('amarillo'));
});

describe('financiero', () => {
  it('ROI y payback', () => {
    const bs = Array.from({ length: 8 }, (_, i) => ben(i + 1, 10, 10));
    const f = financiero(p, bs);
    expect(f.inversion).toBe(60);
    expect(f.roiEsperado).toBe(200);
    expect(f.paybackPlan).toBe(6);
    expect(f.paybackReal).toBe(6);
    expect(f.realTotal).toBe(80);
    expect(f.roiReal).toBeCloseTo(33.33, 1);
  });
  it('sin inversión no hay ROI', () => {
    const f = financiero({ ...p, inversion_capex: 0, inversion_opex: 0 }, []);
    expect(f.roiEsperado).toBeNull();
    expect(f.paybackPlan).toBeNull();
  });
});

describe('kpi y costos', () => {
  it('progreso KPI en ambos sentidos', () => {
    expect(progresoKpi({ linea_base: 2, meta: 1, actual: 1.5, sentido: 'menor' } as never)).toBe(50);
    expect(progresoKpi({ linea_base: 70, meta: 72, actual: 71.5, sentido: 'mayor' } as never)).toBe(75);
    expect(progresoKpi({ linea_base: 70, meta: 72, actual: null, sentido: 'mayor' } as never)).toBeNull();
  });
  it('agrega solo meses con real', () => {
    const rows = [
      { id: '1', planta_id: 'a', clase_id: 'x', anio: 2026, mes: 1, presupuesto: 100, costo_real: 110, estandar: 98 },
      { id: '2', planta_id: 'a', clase_id: 'x', anio: 2026, mes: 2, presupuesto: 100, costo_real: null, estandar: 98 },
    ];
    const a = aggCostos(rows, { anio: 2026, desde: 1, hasta: 12 });
    expect(a).toMatchObject({ presupuesto: 100, real: 110, desv: 10, desvPct: 10 });
    expect(saludDesviacion(a.desvPct)).toBe('rojo');
  });
  it('último mes cerrado', () => {
    expect(ultimoMesCerrado(new Date(2026, 9, 2))).toEqual({ anio: 2026, mes: 9 });
    expect(ultimoMesCerrado(new Date(2026, 0, 15))).toEqual({ anio: 2025, mes: 12 });
  });
});
