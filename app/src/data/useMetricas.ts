import { useMemo } from 'react';
import {
  avanceEsperado, avanceProyecto, beneficioAcumulado, financiero, hitosAtrasados, hoyISO, peorSalud,
  saludBeneficio, saludPlazo, ultimoCheckin, ultimoMesCerrado, type Acumulado, type Financiero,
} from '../lib/calc';
import type { Checkin, Proyecto, Salud } from '../lib/types';
import { useStore } from './store';

export interface MetricaProyecto {
  p: Proyecto;
  avance: number;
  esperado: number;
  atrasados: number;
  plazo: Salud;
  acum: Acumulado;          // plan vs real hasta el último mes cerrado
  planAnio: number;         // plan del año calendario completo
  beneficio: Salud | null;
  checkin?: Checkin;
  salud: Salud;             // peor entre plazo, beneficio y lo reportado por el líder
  fin: Financiero;
}

/** Métricas de todos los proyectos (sin filtrar) indexadas por id. */
export function useMetricas() {
  const { db } = useStore();
  return useMemo(() => {
    const hoy = hoyISO();
    const cierre = ultimoMesCerrado();
    const anio = new Date().getFullYear();
    const map = new Map<string, MetricaProyecto>();
    for (const p of db.proyectos) {
      const acum = beneficioAcumulado(p.id, db.beneficios_mensuales, cierre);
      const planAnio = db.beneficios_mensuales.filter((b) => b.proyecto_id === p.id && b.anio === anio).reduce((s, b) => s + b.ahorro_plan, 0);
      const plazo = saludPlazo(p, db.hitos, hoy);
      const beneficio = saludBeneficio(acum);
      const checkin = ultimoCheckin(p.id, db.checkins);
      map.set(p.id, {
        p, acum, planAnio, plazo, beneficio, checkin,
        avance: avanceProyecto(p, db.hitos),
        esperado: avanceEsperado(p, db.hitos, hoy),
        atrasados: hitosAtrasados(p, db.hitos, hoy).length,
        salud: p.etapa === 'Idea' ? 'verde' : peorSalud([plazo, beneficio, checkin?.salud]),
        fin: financiero(p, db.beneficios_mensuales),
      });
    }
    return { map, cierre, anio, hoy };
  }, [db]);
}

/** Proyectos visibles con el filtro global de planta. */
export function useProyectosVisibles() {
  const { db, plantasVisibles } = useStore();
  return useMemo(() => db.proyectos.filter((p) => plantasVisibles.includes(p.planta_id)), [db.proyectos, plantasVisibles]);
}
