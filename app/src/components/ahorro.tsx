// Vocabulario único del ahorro: 4 conceptos, siempre con el mismo color, nombre y definición.
import type { ReactNode } from 'react';
import { fMM, fPct0, fSigno } from '../lib/format';
import { Icon } from './Icon';
import { useTip } from './ui';

export type ConceptoAhorro = 'logrado' | 'esperado' | 'comprometido' | 'meta' | 'potencial' | 'brecha' | 'sinProyecto';

export const AHORRO: Record<ConceptoAhorro, { label: string; color: string; def: string }> = {
  logrado: { label: 'Logrado', color: 'var(--c-real)', def: 'Ahorro real medido contra la línea base, hasta el último mes cerrado.' },
  esperado: { label: 'Esperado a la fecha', color: 'var(--c-plan)', def: 'Lo que ya deberíamos haber ahorrado según la curva plan de los proyectos, hasta el último mes cerrado.' },
  comprometido: { label: 'Comprometido (año)', color: 'var(--c-comp)', def: 'Ahorro anual que prometen los proyectos aprobados o en evaluación.' },
  meta: { label: 'Meta anual', color: 'var(--c-meta)', def: 'Ahorro que la planta debe lograr este año (lo fija Control de Gestión).' },
  brecha: { label: 'Brecha vs estándar', color: 'var(--neg)', def: 'Cuánto estamos gastando por sobre el costo estándar, llevado a un año: (costo real − costo estándar de los meses cerrados) × 12 ÷ meses cerrados.' },
  potencial: { label: 'Potencial', color: 'var(--c-pot)', def: 'Ahorro anual máximo si se captura la oportunidad completa: costo base anual × % de mejora alcanzable según una referencia (estándar, mejor planta, benchmark o cotización).' },
  sinProyecto: { label: 'Sin proyecto', color: 'var(--c-pot-soft)', def: 'Potencial que todavía no ataca ningún proyecto: potencial − comprometido en proyectos. Es la cartera de nuevas iniciativas.' },
};

/** Punto de color + nombre del concepto; al pasar el mouse muestra la definición. */
export function Concepto({ c, children }: { c: ConceptoAhorro; children?: ReactNode }) {
  const tip = useTip();
  const a = AHORRO[c];
  return (
    <span className="concepto" title={a.def} onMouseMove={(e) => tip.show(e, <><b>{a.label}</b>{a.def}</>)} onMouseLeave={tip.hide}>
      <i className="sw-dot" style={{ background: a.color }} />{children ?? a.label}
    </span>
  );
}

function estadoAvance(logrado: number, esperado: number) {
  if (esperado <= 0) return null;
  const r = logrado / esperado;
  if (r >= 1) return { cls: 'good', icon: 'checkCircle' as const, txt: 'Adelantado' };
  if (r >= 0.95) return { cls: 'good', icon: 'checkCircle' as const, txt: 'Al día' };
  if (r >= 0.8) return { cls: 'warn', icon: 'alertCircle' as const, txt: 'Algo atrasado' };
  return { cls: 'crit', icon: 'xCircle' as const, txt: 'Atrasado' };
}

function estadoCobertura(comprometido: number, meta: number) {
  if (meta <= 0) return null;
  const r = comprometido / meta;
  if (r >= 1) return { cls: 'good', icon: 'checkCircle' as const, txt: 'Meta cubierta' };
  if (r >= 0.8) return { cls: 'warn', icon: 'alertCircle' as const, txt: 'Cobertura parcial' };
  return { cls: 'crit', icon: 'xCircle' as const, txt: 'Falta identificar' };
}

function Pill({ e }: { e: { cls: string; icon: 'checkCircle' | 'alertCircle' | 'xCircle'; txt: string } | null }) {
  if (!e) return null;
  return <span className={`pill ${e.cls}`}><Icon name={e.icon} size={13} />{e.txt}</span>;
}

/** Barra con un valor (relleno) y una referencia (marca vertical), en la misma escala. */
function Bullet({ valor, referencia, colorValor, colorRef, refDashed, label }: {
  valor: number; referencia: number; colorValor: string; colorRef: string; refDashed?: boolean; label: string;
}) {
  const max = Math.max(valor, referencia, 1) * 1.08;
  return (
    <div className="bullet" role="img" aria-label={label}>
      <i className="bullet-fill" style={{ width: `${(valor / max) * 100}%`, background: colorValor }} />
      <i className={`bullet-ref ${refDashed ? 'dashed' : ''}`} style={{ left: `${(referencia / max) * 100}%`, borderColor: colorRef }} />
    </div>
  );
}

/** Pregunta 1: ¿vamos al día? (logrado vs esperado a la fecha). */
export function AvanceAhorro({ logrado, esperado, compacto }: { logrado: number; esperado: number; compacto?: boolean }) {
  const d = logrado - esperado;
  const e = estadoAvance(logrado, esperado);
  return (
    <div className="ah-row">
      <div className="ah-q">
        {!compacto && <span className="ah-title">¿Vamos al día con el ahorro?</span>}
        <Pill e={e} />
      </div>
      <Bullet valor={logrado} referencia={esperado} colorValor={AHORRO.logrado.color} colorRef={AHORRO.esperado.color} label="Logrado vs esperado" />
      <p className="ah-txt">
        <Concepto c="logrado"><b className="num">{fMM(logrado)} MM</b> logrados</Concepto>{' '}de{' '}
        <Concepto c="esperado"><b className="num">{fMM(esperado)} MM</b> esperados</Concepto>
        {esperado > 0 && <> · <b className={d >= 0 ? 'txt-good' : 'txt-crit'}>{fSigno(d)} MM {d >= 0 ? 'por sobre lo esperado' : 'bajo lo esperado'}</b> ({fPct0((logrado / esperado) * 100)})</>}
      </p>
    </div>
  );
}

/** Pregunta 2: ¿alcanza para la meta? (comprometido anual vs meta anual). */
export function CoberturaMeta({ comprometido, meta, compacto }: { comprometido: number; meta: number; compacto?: boolean }) {
  const d = comprometido - meta;
  const e = estadoCobertura(comprometido, meta);
  return (
    <div className="ah-row">
      <div className="ah-q">
        {!compacto && <span className="ah-title">¿Los proyectos alcanzan para la meta del año?</span>}
        <Pill e={e} />
      </div>
      <Bullet valor={comprometido} referencia={meta} colorValor={AHORRO.comprometido.color} colorRef={AHORRO.meta.color} refDashed label="Comprometido vs meta" />
      <p className="ah-txt">
        <Concepto c="comprometido"><b className="num">{fMM(comprometido)} MM</b> comprometidos</Concepto>{' '}vs{' '}
        <Concepto c="meta"><b className="num">{fMM(meta)} MM</b> de meta</Concepto>
        {meta > 0 && (d >= 0
          ? <> · <b className="txt-good">cubre el {fPct0((comprometido / meta) * 100)}</b></>
          : <> · <b className="txt-crit">faltan {fMM(-d)} MM en nuevos proyectos</b></>)}
      </p>
    </div>
  );
}

/** Panel completo: 4 cifras con su definición visible + las dos preguntas. */
export function PanelAhorro({ logrado, esperado, comprometido, meta }: { logrado: number; esperado: number; comprometido: number; meta?: number }) {
  const conceptos: [ConceptoAhorro, number][] = [['logrado', logrado], ['esperado', esperado], ['comprometido', comprometido]];
  if (meta != null) conceptos.push(['meta', meta]);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className={`ah-cifras n${conceptos.length}`}>
        {conceptos.map(([c, v]) => (
          <div key={c} className="ah-cifra" style={{ borderTopColor: AHORRO[c].color }}>
            <span className="ah-label"><i className="sw-dot" style={{ background: AHORRO[c].color }} />{AHORRO[c].label}</span>
            <span className="ah-valor num">{fMM(v)}<small>MM</small></span>
            <span className="ah-def">{AHORRO[c].def}</span>
          </div>
        ))}
      </div>
      <AvanceAhorro logrado={logrado} esperado={esperado} />
      {meta != null && <CoberturaMeta comprometido={comprometido} meta={meta} />}
    </div>
  );
}

/** Cumplimiento logrado/esperado como texto con ícono (para tablas). */
export function Cumplimiento({ logrado, esperado }: { logrado: number; esperado: number }) {
  const e = estadoAvance(logrado, esperado);
  if (!e) return <span className="muted">—</span>;
  return <span className={`pill ${e.cls}`} title={e.txt}><Icon name={e.icon} size={12} />{fPct0((logrado / esperado) * 100)}</span>;
}
