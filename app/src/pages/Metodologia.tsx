// «Cómo se calcula»: cada número de la herramienta, con su fórmula y un ejemplo con datos reales.
import { useEffect, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AHORRO, Concepto } from '../components/ahorro';
import { Icon } from '../components/Icon';
import { Card, EtapaBadge, SaludBadge } from '../components/ui';
import { useStore } from '../data/store';
import { useMetricas } from '../data/useMetricas';
import {
  aggCostos, ahorroPonderado, brechaAnualizada, COMPLEJIDAD_LABEL, CUADRANTES, PROB_ETAPA, probabilidad, progresoKpi, puntaje, type Cuadrante,
} from '../lib/calc';
import { fMM, fMes, fNum, fPct, fPct0 } from '../lib/format';
import { ETAPAS, MESES, ROLES } from '../lib/types';

const SECCIONES: [string, string][] = [
  ['ciclo', 'Ciclo de vida y gates'], ['avance', 'Avance'], ['salud', 'Semáforo'], ['ahorro', 'Ahorro'],
  ['roi', 'ROI y payback'], ['kpis', 'KPIs operativos'], ['oportunidades', 'Árbol de oportunidades'],
  ['priorizacion', 'Priorización'], ['costos', 'Desviaciones de costo'], ['roles', 'Roles'],
];

function Formula({ children }: { children: ReactNode }) {
  return <div className="formula-box">{children}</div>;
}
function Ejemplo({ children }: { children: ReactNode }) {
  return <div className="ejemplo"><span className="eyebrow">Ejemplo con tus datos</span><div>{children}</div></div>;
}
function Seccion({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return <Card className="mt metodo" title={<span id={`s-${id}`}>{titulo}</span>}>{children}</Card>;
}

export function Metodologia() {
  const { db, plantasVisibles } = useStore();
  const { map, cierre, anio } = useMetricas();
  const [params] = useSearchParams();
  const s = params.get('s');
  useEffect(() => { if (s) document.getElementById(`s-${s}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [s]);

  // Proyecto de ejemplo: el primero en ejecución con hitos, beneficios, inversión y KPI medido
  const ms = [...map.values()];
  const ej = ms.find((m) => m.p.etapa === 'En ejecución' && m.acum.plan > 0 && m.fin.inversion > 0) ?? ms[0];
  const p = ej?.p;
  const hs = p ? db.hitos.filter((h) => h.proyecto_id === p.id) : [];
  const pesoT = hs.reduce((a, h) => a + h.peso, 0), pesoOk = hs.filter((h) => h.fecha_real).reduce((a, h) => a + h.peso, 0);
  const kpi = db.kpis.find((k) => k.proyecto_id === p?.id && k.actual != null) ?? db.kpis.find((k) => k.actual != null);
  const op = db.oportunidades.find((o) => o.costo_base > 0);
  const brecha = brechaAnualizada(db.costos_mensuales, { plantas: plantasVisibles, anio });
  const cos = aggCostos(db.costos_mensuales, { plantas: plantasVisibles, anio, desde: 1, hasta: 12 });

  return (
    <>
      <div className="page-head">
        <div><h1>Cómo se calcula</h1><p>La metodología detrás de cada número. Los ejemplos usan los datos actuales del sistema, así que siempre coinciden con lo que ves.</p></div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {SECCIONES.map(([id, t]) => <Link key={id} className="badge" to={`/metodologia?s=${id}`}>{t}</Link>)}
      </div>

      <Seccion id="ciclo" titulo="1. Ciclo de vida del proyecto y gates (stage-gate)">
        <p>Cada proyecto avanza por 5 etapas. Para pasar a la siguiente debe cumplir los criterios de un <b>gate</b>: un control que evita comprometer recursos en proyectos que no están listos. Los criterios se revisan solos con los datos del proyecto y se ven en su ficha. Solo Control de Gestión puede avanzar un proyecto por excepción, sin cumplir todos los criterios.</p>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Etapa</th><th>Para pasar a la siguiente se exige</th><th className="num">Probabilidad estándar</th></tr></thead>
            <tbody>
              <tr><td><EtapaBadge etapa="Idea" /></td><td>Descripción del objetivo, ahorro anual estimado y líder asignado.</td><td className="num">{PROB_ETAPA.Idea} %</td></tr>
              <tr><td><EtapaBadge etapa="Evaluación" /></td><td>Línea base medible, sponsor, plan con 3 o más hitos, KPI operativo, curva plan de ahorro y aprobación del jefe de planta o Control de Gestión.</td><td className="num">{PROB_ETAPA['Evaluación']} %</td></tr>
              <tr><td><EtapaBadge etapa="En ejecución" /></td><td>Todos los hitos completados y al menos un mes con ahorro real medido.</td><td className="num">{PROB_ETAPA['En ejecución']} %</td></tr>
              <tr><td><EtapaBadge etapa="Implementado" /></td><td>3 meses de ahorro medido, ahorro logrado de al menos 80 % de lo esperado y sin acciones abiertas.</td><td className="num">{PROB_ETAPA.Implementado} %</td></tr>
              <tr><td><EtapaBadge etapa="Cerrado" /></td><td>Beneficio validado. El proyecto sale de la cartera activa.</td><td className="num">{PROB_ETAPA.Cerrado} %</td></tr>
            </tbody>
          </table>
        </div>
        <p className="small muted">La probabilidad estándar dice qué tan seguro es capturar el ahorro en cada etapa. El líder puede ajustarla en la ficha si tiene información mejor (por ejemplo, una cotización firmada).</p>
      </Seccion>

      <Seccion id="avance" titulo="2. Avance real vs avance planificado">
        <p>El avance no se declara a ojo: se calcula con los <b>hitos</b>. Cada hito tiene un <b>peso</b> según su importancia.</p>
        <Formula>Avance real = Σ peso de hitos completados ÷ Σ peso de todos los hitos</Formula>
        <Formula>Avance planificado = Σ peso de hitos cuya fecha plan ya pasó ÷ Σ peso de todos los hitos</Formula>
        <p className="small muted">Si el proyecto no tiene hitos, se usa el avance manual de la ficha y el planificado se calcula en forma lineal entre inicio y término.</p>
        {p && pesoT > 0 && <Ejemplo><Link to={`/proyectos/${p.id}`}>{p.nombre}</Link>: hitos completados suman {pesoOk} de {pesoT} puntos de peso → <b>avance real {ej.avance} %</b>. Según las fechas plan debería llevar <b>{ej.esperado} %</b>.</Ejemplo>}
      </Seccion>

      <Seccion id="salud" titulo="3. Semáforo del proyecto">
        <p>El estado de un proyecto es el <b>peor</b> de tres criterios. Así, un proyecto al día en plazo pero que no genera ahorro igual aparece en riesgo.</p>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Criterio</th><th><SaludBadge s="verde" /></th><th><SaludBadge s="amarillo" /></th><th><SaludBadge s="rojo" /></th></tr></thead>
            <tbody>
              <tr><td><b>Plazo</b> (hitos)</td><td>Sin hitos vencidos</td><td>Hito atrasado 30 días o menos (o fecha de término vencida)</td><td>Hito atrasado más de 30 días</td></tr>
              <tr><td><b>Beneficio</b> (logrado ÷ esperado)</td><td>95 % o más</td><td>Entre 80 % y 95 %</td><td>Bajo 80 %</td></tr>
              <tr><td><b>Reporte del líder</b></td><td colSpan={3}>El estado que el líder eligió en su último «Registrar avance».</td></tr>
            </tbody>
          </table>
        </div>
        {p && <Ejemplo><Link to={`/proyectos/${p.id}`}>{p.nombre}</Link>: plazo <SaludBadge s={ej.plazo} />, beneficio <SaludBadge s={ej.beneficio} />, líder <SaludBadge s={ej.checkin?.salud ?? null} /> → resultado <SaludBadge s={ej.salud} /></Ejemplo>}
      </Seccion>

      <Seccion id="ahorro" titulo="4. Ahorro: logrado, esperado, comprometido y meta">
        <p>El ahorro siempre se mide contra la <b>línea base</b> del proyecto: la situación antes de la mejora, con número y período (por ejemplo, «merma 1,9 % promedio de los últimos 6 meses»). Cada mes, el líder registra cuánto se ahorró contra esa línea base.</p>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Concepto</th><th>Fórmula</th></tr></thead>
            <tbody>
              <tr><td><Concepto c="logrado" /></td><td>Σ ahorro real de los meses cerrados (hasta {MESES[cierre.mes - 1]} {cierre.anio})</td></tr>
              <tr><td><Concepto c="esperado" /></td><td>Σ ahorro plan de esos mismos meses (curva plan del proyecto)</td></tr>
              <tr><td><Concepto c="comprometido" /></td><td>Ahorro anual que promete el proyecto (ficha). En el portafolio no se cuentan las ideas</td></tr>
              <tr><td><Concepto c="meta" /></td><td>Meta anual de cada planta, la fija Control de Gestión</td></tr>
            </tbody>
          </table>
        </div>
        <Formula>¿Vamos al día? = Logrado ÷ Esperado (≥ 95 % al día · 80–95 % algo atrasado · &lt; 80 % atrasado)</Formula>
        <Formula>¿Alcanza para la meta? = Comprometido ÷ Meta (≥ 100 % meta cubierta)</Formula>
        <Formula>Curva plan (botón «Generar curva plan») = ahorro anual ÷ 12 por mes, con rampa de 40 % → 70 % → 100 % en los primeros meses</Formula>
        {p && <Ejemplo><Link to={`/proyectos/${p.id}`}>{p.nombre}</Link>: logrado <b>{fMM(ej.acum.real)} MM</b> ÷ esperado <b>{fMM(ej.acum.plan)} MM</b> = <b>{ej.acum.plan ? fPct0((ej.acum.real / ej.acum.plan) * 100) : '—'}</b>.</Ejemplo>}
      </Seccion>

      <Seccion id="roi" titulo="5. Retorno de la inversión (ROI) y payback">
        <Formula>Inversión = CAPEX + OPEX de implementación (una sola vez)</Formula>
        <Formula>ROI esperado (anual) = Ahorro comprometido anual ÷ Inversión</Formula>
        <Formula>Payback plan (meses) = Inversión ÷ (Ahorro comprometido anual ÷ 12)</Formula>
        <Formula>ROI realizado = (Ahorro logrado acumulado − Inversión) ÷ Inversión · Payback real = meses de ahorro logrado hasta igualar la inversión</Formula>
        {p && ej.fin.inversion > 0 && <Ejemplo><Link to={`/proyectos/${p.id}`}>{p.nombre}</Link>: {fMM(p.ahorro_comprometido_anual)} ÷ {fMM(ej.fin.inversion)} = <b>ROI esperado {fPct0(ej.fin.roiEsperado ?? 0)}</b>; {fMM(ej.fin.inversion)} ÷ ({fMM(p.ahorro_comprometido_anual)} ÷ 12) = <b>payback {fNum(ej.fin.paybackPlan ?? 0)} meses</b>.</Ejemplo>}
      </Seccion>

      <Seccion id="kpis" titulo="6. KPIs operativos (beneficios no financieros)">
        <p>Sirven para ver la mejora física detrás del ahorro: % de rendimiento, horas hombre, kWh, % de merma.</p>
        <Formula>Progreso = (Actual − Línea base) ÷ (Meta − Línea base)</Formula>
        <p className="small muted">La fórmula sirve tanto cuando conviene que el KPI baje (merma) como cuando conviene que suba (rendimiento).</p>
        {kpi && <Ejemplo>{kpi.nombre}: ({fNum(kpi.actual!, 2)} − {fNum(kpi.linea_base, 2)}) ÷ ({fNum(kpi.meta, 2)} − {fNum(kpi.linea_base, 2)}) = <b>{progresoKpi(kpi)} % del camino hacia la meta</b>.</Ejemplo>}
      </Seccion>

      <Seccion id="oportunidades" titulo="7. Árbol de oportunidades: brecha, potencial, en proyectos y sin proyecto">
        <p>Responde «¿cuánto ahorro es posible y cuánto estamos atacando?». Se lee como una cascada de 4 pasos:</p>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Paso</th><th>Qué es</th><th>Fórmula</th></tr></thead>
            <tbody>
              <tr><td><Concepto c="brecha" /></td><td>Cuánto gastamos por sobre el estándar, llevado a un año</td><td>(costo real − costo estándar de los meses cerrados) × 12 ÷ meses cerrados</td></tr>
              <tr><td><Concepto c="potencial" /></td><td>El ahorro máximo de una oportunidad si se captura completa</td><td>costo base anual × % de mejora alcanzable</td></tr>
              <tr><td><Concepto c="comprometido">En proyectos</Concepto></td><td>Parte del potencial que ya ataca algún proyecto</td><td>Σ ahorro comprometido de los proyectos ligados a la oportunidad (sin contar ideas)</td></tr>
              <tr><td><Concepto c="sinProyecto" /></td><td>Potencial que todavía nadie ataca: la cartera de nuevas iniciativas</td><td>potencial − en proyectos</td></tr>
            </tbody>
          </table>
        </div>
        <p><b>¿De dónde sale el % de mejora?</b> De una <b>referencia</b> objetiva que queda escrita en la oportunidad: el costo estándar, la mejor planta del grupo, un benchmark de la industria o una cotización. Por ejemplo, si la merma es 1,9 % y el estándar es 1,2 %, la mejora alcanzable es (1,9 − 1,2) ÷ 1,9 = 37 %.</p>
        <Ejemplo>
          Brecha medida en {anio}: costo real − estándar = <b>{fMM(brecha.acumulada)} MM</b> en {brecha.meses} meses → × 12 ÷ {brecha.meses} = <b>{fMM(brecha.anual)} MM/año</b>.
          {op && <> Oportunidad «{op.nombre}»: {fMM(op.costo_base)} MM × {fNum(op.mejora_pct)} % = <b>{fMM(op.potencial)} MM/año</b> de potencial ({op.referencia}).</>}
        </Ejemplo>
      </Seccion>

      <Seccion id="priorizacion" titulo="8. Priorización: valor ponderado por riesgo vs esfuerzo">
        <Formula>Ahorro ponderado = Ahorro comprometido × Probabilidad de éxito</Formula>
        <Formula>Puntaje = Ahorro ponderado ÷ Complejidad (1 muy baja … 5 muy alta)</Formula>
        <p>La matriz cruza el valor (ahorro ponderado, alto si supera la mediana del grupo) con el esfuerzo (alto si la complejidad es 4 o 5):</p>
        <div className="row" style={{ gap: 6 }}>
          {(Object.keys(CUADRANTES) as Cuadrante[]).map((q) => <span key={q} className="badge wrap">{CUADRANTES[q].titulo}: {CUADRANTES[q].accion.toLowerCase()}</span>)}
        </div>
        {p && <Ejemplo><Link to={`/proyectos/${p.id}`}>{p.nombre}</Link>: {fMM(p.ahorro_comprometido_anual)} × {probabilidad(p)} % = <b>{fMM(ahorroPonderado(p))} MM ponderados</b>; ÷ complejidad {p.complejidad} ({COMPLEJIDAD_LABEL[p.complejidad]}) = <b>puntaje {fNum(puntaje(p), 1)}</b>.</Ejemplo>}
      </Seccion>

      <Seccion id="costos" titulo="9. Desviaciones de costo">
        <Formula>Desviación = Costo real − Presupuesto · Desviación % = Desviación ÷ Presupuesto</Formula>
        <p>Solo se comparan meses que ya tienen costo real, para no mezclar meses cerrados con meses abiertos. Semáforo: <SaludBadge s="verde" label="≤ 0,5 %" /> <SaludBadge s="amarillo" label="0,5 % a 3 %" /> <SaludBadge s="rojo" label="≥ 3 % sobre presupuesto" /></p>
        <Formula>Proyección de cierre = Costo real de los meses cerrados + Presupuesto de los meses que faltan</Formula>
        <Ejemplo>Acumulado {anio}: real {fMM(cos.real)} − presupuesto {fMM(cos.presupuesto)} = <b>{fMM(cos.desv)} MM ({fPct(cos.desvPct, true)})</b>.</Ejemplo>
      </Seccion>

      <Seccion id="roles" titulo="10. Roles y permisos">
        <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          <li><b>{ROLES.lider}:</b> crea proyectos y actualiza los suyos (hitos, avance, ahorro mensual, KPIs, acciones).</li>
          <li><b>{ROLES.jefe_planta}:</b> aprueba y edita los proyectos de su planta; carga el presupuesto y el costo real; gestiona el árbol de oportunidades.</li>
          <li><b>{ROLES.admin}:</b> todo, incluido fijar metas, gestionar usuarios y avanzar gates por excepción.</li>
          <li><b>{ROLES.gerencia}:</b> ve todo y comenta, pero no edita.</li>
        </ul>
      </Seccion>
      <p className="xs muted mt"><Icon name="info" size={12} /> Montos en millones de CLP (MM). Meses cerrados hasta {fMes(cierre.anio, cierre.mes)}. Probabilidades estándar por etapa: {ETAPAS.map((e) => `${e} ${PROB_ETAPA[e]} %`).join(' · ')}. Colores del ahorro: {(['logrado', 'esperado', 'comprometido', 'meta'] as const).map((c) => AHORRO[c].label).join(', ')}.</p>
    </>
  );
}
