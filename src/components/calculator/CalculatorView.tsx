import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Delete, Search, Sigma, Trash2 } from 'lucide-react';
import { evaluateExpression } from '../../domain/calculator/evaluator';
import {
  countFormulasByProfession,
  filterMathFormulas,
  MATH_FORMULAS,
  PROFESSION_CATEGORIES,
  type ProfessionCategory,
} from '../../domain/calculator/formulas';
import type { AngleUnit, CalcHistoryEntry } from '../../domain/types';

interface CalculatorViewProps {
  readonly angleUnit: AngleUnit;
  readonly history: readonly CalcHistoryEntry[];
  readonly onChangeAngleUnit: (unit: AngleUnit) => void;
  readonly onPushHistory: (entry: CalcHistoryEntry) => void;
  readonly onClearHistory: () => void;
}

const SCI_KEYS: readonly { readonly label: string; readonly token: string }[] = [
  { label: 'sin', token: 'sin(' },
  { label: 'cos', token: 'cos(' },
  { label: 'tan', token: 'tan(' },
  { label: 'ln', token: 'ln(' },
  { label: 'log', token: 'log(' },
  { label: '√', token: 'sqrt(' },
  { label: 'x²', token: '^2' },
  { label: 'xʸ', token: '^' },
  { label: 'π', token: 'pi' },
  { label: 'e', token: 'e' },
];

const MAIN_KEYS: readonly {
  readonly label: string;
  readonly action: 'clear' | 'paren' | 'backspace' | 'percent' | 'equals' | 'append';
  readonly value?: string;
  readonly variant?: 'op' | 'eq';
}[] = [
  { label: 'C', action: 'clear', variant: 'op' },
  { label: '( )', action: 'paren', variant: 'op' },
  { label: '%', action: 'percent', variant: 'op' },
  { label: '÷', action: 'append', value: '÷', variant: 'op' },
  { label: '7', action: 'append', value: '7' },
  { label: '8', action: 'append', value: '8' },
  { label: '9', action: 'append', value: '9' },
  { label: '×', action: 'append', value: '×', variant: 'op' },
  { label: '4', action: 'append', value: '4' },
  { label: '5', action: 'append', value: '5' },
  { label: '6', action: 'append', value: '6' },
  { label: '−', action: 'append', value: '−', variant: 'op' },
  { label: '1', action: 'append', value: '1' },
  { label: '2', action: 'append', value: '2' },
  { label: '3', action: 'append', value: '3' },
  { label: '+', action: 'append', value: '+', variant: 'op' },
  { label: '0', action: 'append', value: '0' },
  { label: '.', action: 'append', value: '.' },
  { label: '⌫', action: 'backspace', variant: 'op' },
  { label: '=', action: 'equals', variant: 'eq' },
];

export function CalculatorView({
  angleUnit,
  history,
  onChangeAngleUnit,
  onPushHistory,
  onClearHistory,
}: CalculatorViewProps) {
  const [expression, setExpression] = useState('');
  const [scientific, setScientific] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sideTab, setSideTab] = useState<'formulas' | 'history'>('formulas');
  const [profession, setProfession] = useState<ProfessionCategory>('Solar & Renewable Energy');
  const [formulaQuery, setFormulaQuery] = useState('');

  const visibleFormulas = useMemo(
    () => filterMathFormulas(profession, formulaQuery),
    [profession, formulaQuery],
  );
  const isSearchingFormulas = formulaQuery.trim().length > 0;

  const liveEval = useMemo(() => {
    if (!expression.trim()) return null;
    return evaluateExpression(expression, angleUnit);
  }, [expression, angleUnit]);

  const appendToken = useCallback((token: string) => {
    setErrorMsg(null);
    setExpression((prev) => prev + token);
  }, []);

  const insertSmartParen = useCallback(() => {
    setErrorMsg(null);
    setExpression((prev) => {
      const openCount = (prev.match(/\(/g) ?? []).length;
      const closeCount = (prev.match(/\)/g) ?? []).length;
      const last = prev.trimEnd().slice(-1);
      if (openCount > closeCount && /[0-9)πe%]/.test(last)) {
        return `${prev})`;
      }
      return `${prev}(`;
    });
  }, []);

  const commitEvaluation = useCallback(() => {
    const res = evaluateExpression(expression, angleUnit);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    onPushHistory({
      id: `calc-${crypto.randomUUID().slice(0, 8)}`,
      expression: expression.trim(),
      result: res.formatted,
      angleUnit,
      createdAt: new Date().toISOString(),
    });
    setExpression(res.formatted);
    setErrorMsg(null);
  }, [expression, angleUnit, onPushHistory]);

  const handleBackspace = useCallback(() => {
    setErrorMsg(null);
    setExpression((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setErrorMsg(null);
    setExpression('');
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]') !== null) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable], button, a')) return;

      if (/^[0-9.+\-*/^()%]$/.test(event.key)) {
        event.preventDefault();
        const mapped = event.key === '*' ? '×' : event.key === '/' ? '÷' : event.key;
        appendToken(mapped);
        return;
      }
      if (event.key === 'Enter' || event.key === '=') {
        event.preventDefault();
        commitEvaluation();
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        handleBackspace();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appendToken, commitEvaluation, handleBackspace, handleClear]);

  const handleCopy = async () => {
    const text = liveEval?.ok ? liveEval.formatted : expression;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard unavailable
    }
  };

  const displayedResult = errorMsg ?? (liveEval?.ok ? liveEval.formatted : expression || '0');

  return (
    <section className="workspace-panel-stage calculator-shell" aria-label="Precision Calculator">
      <div className="glass-surface calc-instrument">
        <div className="calc-mode-bar">
          <div className="filter-group" role="group" aria-label="Calculator layout">
            <button
              type="button"
              className={`filter-pill ${!scientific ? 'is-active' : ''}`}
              onClick={() => setScientific(false)}
            >
              Standard
            </button>
            <button
              type="button"
              className={`filter-pill ${scientific ? 'is-active' : ''}`}
              onClick={() => setScientific(true)}
            >
              Scientific
            </button>
          </div>

          <div className="filter-group" role="group" aria-label="Angle unit">
            <button
              type="button"
              className={`filter-pill mono-num ${angleUnit === 'deg' ? 'is-active' : ''}`}
              onClick={() => onChangeAngleUnit('deg')}
            >
              DEG
            </button>
            <button
              type="button"
              className={`filter-pill mono-num ${angleUnit === 'rad' ? 'is-active' : ''}`}
              onClick={() => onChangeAngleUnit('rad')}
            >
              RAD
            </button>
          </div>
        </div>

        <div className="calc-screen">
          <input
            type="text"
            className="calc-expr-input mono-num"
            aria-label="Math expression"
            placeholder="0"
            value={expression}
            onChange={(e) => {
              setErrorMsg(null);
              setExpression(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitEvaluation();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleClear();
              }
            }}
          />
          <div className="calc-result-row">
            <button
              type="button"
              className="btn-glass is-compact"
              aria-label="Copy result"
              title="Copy result"
              onClick={() => void handleCopy()}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <output
              className={`calc-result-value mono-num ${errorMsg ? 'is-error' : ''}`}
              aria-live="polite"
            >
              {displayedResult}
            </output>
          </div>
        </div>

        {scientific && (
          <div className="calc-sci-grid">
            {SCI_KEYS.map((key) => (
              <button
                key={key.label}
                type="button"
                className="calc-key is-sci"
                onClick={() => appendToken(key.token)}
              >
                {key.label}
              </button>
            ))}
          </div>
        )}

        <div className="calc-main-grid">
          {MAIN_KEYS.map((key) => (
            <button
              key={key.label}
              type="button"
              className={`calc-key ${key.variant ? `is-${key.variant}` : ''}`}
              aria-label={key.action === 'backspace' ? 'Backspace' : key.label}
              onClick={() => {
                if (key.action === 'clear') handleClear();
                else if (key.action === 'paren') insertSmartParen();
                else if (key.action === 'backspace') handleBackspace();
                else if (key.action === 'percent') appendToken('%');
                else if (key.action === 'equals') commitEvaluation();
                else if (key.value) appendToken(key.value);
              }}
            >
              {key.action === 'backspace' ? <Delete size={17} /> : key.label}
            </button>
          ))}
        </div>
      </div>

      <aside className="glass-surface calc-tape" aria-label="Formula Box and Calculation History">
        <div className="calc-tape-top">
          <div className="filter-group" role="tablist" aria-label="Calculator side panel">
            <button
              type="button"
              className={`filter-pill ${sideTab === 'formulas' ? 'is-active' : ''}`}
              onClick={() => setSideTab('formulas')}
            >
              <Sigma size={13} />
              <span>Formula Box</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${sideTab === 'history' ? 'is-active' : ''}`}
              onClick={() => setSideTab('history')}
            >
              History ({history.length})
            </button>
          </div>

          {sideTab === 'history' && (
            <button
              type="button"
              className="btn-glass is-compact"
              disabled={history.length === 0}
              onClick={onClearHistory}
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>

        {sideTab === 'formulas' ? (
          <>
            <select
              className="glass-input"
              aria-label="Select industry"
              value={profession}
              onChange={(e) => {
                setProfession(e.target.value as ProfessionCategory);
                setFormulaQuery('');
              }}
            >
              {PROFESSION_CATEGORIES.map((prof) => (
                <option key={prof} value={prof}>
                  {prof} ({countFormulasByProfession(prof)})
                </option>
              ))}
            </select>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={13}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '0.7rem',
                  opacity: 0.65,
                  pointerEvents: 'none',
                }}
              />
              <input
                type="search"
                className="glass-input"
                aria-label="Search all formulas"
                placeholder={`Search all ${MATH_FORMULAS.length} formulas (kW, battery, ROI...)`}
                value={formulaQuery}
                onChange={(e) => setFormulaQuery(e.target.value)}
                style={{ paddingLeft: '1.9rem', width: '100%' }}
              />
            </div>

            <div className="calc-tape-list scroller">
              {visibleFormulas.length === 0 ? (
                <p className="notes-empty-hint">
                  No formulas match "{formulaQuery.trim()}". Try kW, solar, battery, voltage, or ROI.
                </p>
              ) : (
                visibleFormulas.map((formula) => (
                  <button
                    key={formula.id}
                    type="button"
                    className="calc-tape-item is-formula"
                    onClick={() => {
                      setErrorMsg(null);
                      if (formula.angleUnit && formula.angleUnit !== angleUnit) {
                        onChangeAngleUnit(formula.angleUnit);
                      }
                      setExpression(formula.sampleExpression);
                    }}
                  >
                    <span className="formula-purpose-badge">
                      {isSearchingFormulas ? `${formula.profession} · ${formula.purpose}` : `For: ${formula.purpose}`}
                    </span>
                    <strong className="formula-name">{formula.name}</strong>
                    <span className="formula-symbolic mono-num">{formula.symbolic}</span>
                    <span className="formula-note">{formula.note} · Click to load</span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="calc-tape-list scroller">
            {history.length === 0 ? (
              <p className="notes-empty-hint">
                Evaluated expressions appear here. Click any entry to reuse its result.
              </p>
            ) : (
              history.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="calc-tape-item"
                  onClick={() => {
                    setErrorMsg(null);
                    setExpression(entry.result);
                  }}
                >
                  <span className="calc-hist-expr mono-num">
                    {entry.expression} ({entry.angleUnit.toUpperCase()})
                  </span>
                  <span className="calc-hist-res mono-num">= {entry.result}</span>
                </button>
              ))
            )}
          </div>
        )}
      </aside>
    </section>
  );
}
