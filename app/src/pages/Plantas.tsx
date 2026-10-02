import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Card, Meter, SaludBadge, saludLabel } from '../components/ui';
import { useStore } from '../data/store';
import { useMetricas, type MetricaProyecto } from '../data/useMetricas';
import { diasEntre } from '../lib/calc';
import { fFecha, fMM, fPct0 } from '../lib/format';
import { ROLES, type Salud } from '../lib/types';

const activo = (m: MetricaProyecto) => m.p.etapa === 'Evaluación' || m.p.etapa === 'En ejecución';

function resumen(ms: MetricaProyecto[]) {
  const act = ms.filter(activo);
  const plan = ms.reduce((s, m) => s + m.acum.plan, 0);
  const real = ms.reduce((s, m) => s + m.acum.real, 0);
  return {
    total: ms.length, activos: act.length,
    plan, real, cumpl: plan ? (real / plan) * 100 : null,
    comprometido: ms.filter((m) => m.p.etapa !== 'Idea').reduce((s, m) => s + m.p.ahorro_comprometido_anual, 0),
    avanceProm: act.length ? Math.round(act.reduce((s, m) => s + m.avance, 0) / act.length) : null,
    atrasados: ms.reduce((s, m) => s + m.atrasados, 0),
    salud: (s: Salud) => act.filter((m) => m.salud === s).length,
    inversion: ms.reduce((s, m) => s + m.fin.inversion, 0),
  };
}

export function Plantas() {
  const { db, plantasVisibles, plantaDe } = useStore();
  const { map, hoy } = useMetricas();
  const todas = [...map.values()];
  const plantas = db.plantas.filter((p) => plantasVisibles.includes(p.id));
  const lideres = db.perfiles.filter((p) => todas.some((m) => m.p.lider_id === p.id && plantasVisibles.includes(m.p.planta_id)));

  return (
    <>
      <div className="page-head"><div><h1>Plantas y líderes</h1><p>Comparativa de desempeño del portafolio por planta y por líder de proyecto</p></div></div>

      <div className="grid g3">
        {plantas.map((pl) => {
          const ms = todas.filter((m) => m.p.planta_id === pl.id);
          const r = resumen(ms);
          const jefe = db.perfiles.find((p) => p.rol === 'jefe_planta' && p.planta_id === pl.id);
          const vencidas = db.acciones.filter((a) => a.estado !== 'Hecha' && a.fecha_vencimiento < hoy && ms.some((m) => m.p.id === a.proyecto_id)).length;
          return (
            <Card key={pl.id} title={<span className="row"><Icon name="factory" />{pl.nombre}</span>} sub={jefe ? `Jefe de planta: ${jefe.nombre}` : undefined}>
              <div className="stack" style={{ gap: 12 }}>
                <div>
                  <div className="row between small"><span className="muted">Ahorro real vs plan a la fecha</span><b className="num">{fMM(r.real)} / {fMM(r.plan)} MM</b></div>
                  <div style={{ marginTop: 5 }}><Meter value={r.real} max={Math.max(r.plan, r.real)} label="Real vs plan" /></div>
                </div>
                <div>
                  <div className="row between small"><span className="muted">Comprometido vs meta anual</span><b className="num">{fMM(r.comprometido)} / {fMM(pl.meta_ahorro_anual)} MM</b></div>
                  <div style={{ marginTop: 5 }}><Meter value={r.comprometido} max={Math.max(pl.meta_ahorro_anual, r.comprometido)} mark={pl.meta_ahorro_anual} label="Comprometido vs meta" /></div>
                </div>
                <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
                  <dt>Proyectos (activos)</dt><dd className="num">{r.total} ({r.activos})</dd>
                  <dt>Avance promedio activos</dt><dd className="num">{r.avanceProm == null ? '—' : `${r.avanceProm}%`}</dd>
                  <dt>Cumplimiento de beneficio</dt><dd className="num">{r.cumpl == null ? '—' : fPct0(r.cumpl)}</dd>
                  <dt>Inversión</dt><dd className="num">{fMM(r.inversion)} MM</dd>
                  <dt>Hitos atrasados · acciones vencidas</dt><dd className="num">{r.atrasados} · {vencidas}</dd>
                </dl>
                <div className="row" style={{ gap: 6 }}>
                  {(['verde', 'amarillo', 'rojo'] as Salud[]).map((s) => <SaludBadge key={s} s={s} label={`${r.salud(s)} ${saludLabel(s).toLowerCase()}`} />)}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card flush className="mt" title="Scorecard por líder de proyecto" sub="Check-in al día = último reporte hace 14 días o menos en todos sus proyectos activos">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Líder</th><th>Planta</th><th className="num">Proyectos</th><th className="num">Activos</th><th className="num">Avance prom.</th><th className="num">Beneficio real / plan</th><th className="num">Hitos atrasados</th><th>Último check-in</th><th>Salud</th></tr>
            </thead>
            <tbody>
              {lideres.map((l) => {
                const ms = todas.filter((m) => m.p.lider_id === l.id && plantasVisibles.includes(m.p.planta_id));
                const r = resumen(ms);
                const act = ms.filter(activo);
                const dias = act.map((m) => (m.checkin ? diasEntre(m.checkin.fecha, hoy) : 999));
                const peorDias = dias.length ? Math.max(...dias) : null;
                const ultimo = ms.map((m) => m.checkin?.fecha).filter(Boolean).sort().pop();
                return (
                  <tr key={l.id}>
                    <td><Link to={`/proyectos?lider=${l.id}`} className="strong">{l.nombre}</Link><div className="xs muted">{ROLES[l.rol]}</div></td>
                    <td className="small">{plantaDe(l.planta_id)?.nombre ?? '—'}</td>
                    <td className="num">{r.total}</td>
                    <td className="num">{r.activos}</td>
                    <td className="num">{r.avanceProm == null ? '—' : `${r.avanceProm}%`}</td>
                    <td className="num">{fMM(r.real)} / {fMM(r.plan)}{r.cumpl != null && <span className="muted"> ({fPct0(r.cumpl)})</span>}</td>
                    <td className="num">{r.atrasados}</td>
                    <td className="small nowrap">
                      {peorDias == null ? '—' : peorDias <= 14
                        ? <span className="row" style={{ gap: 4 }}><Icon name="checkCircle" size={13} style={{ color: 'var(--good)' }} /> Al día · {fFecha(ultimo)}</span>
                        : <span className="row" style={{ gap: 4 }}><Icon name="alert" size={13} style={{ color: 'var(--warn)' }} /> {peorDias >= 999 ? 'Sin reportes' : `Atrasado ${peorDias} d`}</span>}
                    </td>
                    <td className="nowrap">{(['rojo', 'amarillo', 'verde'] as Salud[]).filter((s) => r.salud(s)).map((s) => <span key={s} style={{ marginRight: 4 }}><SaludBadge s={s} label={String(r.salud(s))} /></span>)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
