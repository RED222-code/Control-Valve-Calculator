import { CONDITIONS } from '../data/serviceConfig.js';
import ErrorMessage from './ErrorMessage.jsx';
import { FLOW_UNITS, PRESSURE_UNITS } from '../utils/displayUnits.js';

export default function InputRow({ row, service, data, errors, temperatureUnit, onTemperatureUnitChange, units = {}, onUnitChange, onChange }) {
  const displayLabel = service === 'gas' ? row.gasLabel ?? row.label : row.label;
  const options = row.key === 'Q' ? Object.keys(FLOW_UNITS[service]) : ['P1', 'P2'].includes(row.key) ? Object.keys(PRESSURE_UNITS) : null;
  const unit = row.key === 'T' ? temperatureUnit : row.key === 'Q' ? units.flow ?? (service === 'gas' ? 'SCFM' : 'gpm') : ['P1', 'P2'].includes(row.key) ? units.pressure ?? 'psi' : row.unit;
  return (
    <tr>
      <th scope="row">
        <span className="variable-name">{displayLabel}<span className="variable-symbol">{row.symbol}</span></span>
        {row.key === 'T' && <span className="row-detail">Reference only</span>}
      </th>
      <td className="unit-cell">
        <span className="sr-only" id={`${service}-${row.key}-unit`}>{unit === '—' ? 'Dimensionless' : `Unit: ${unit}`}</span>
        {row.key === 'T' ? (
          <select aria-label="Temperature unit" value={temperatureUnit} onChange={(event) => onTemperatureUnitChange(event.target.value)} className="unit-select"><option value="F">°F</option><option value="C">°C</option><option value="K">K</option></select>
        ) : options ? <select className="unit-select" aria-label={`${displayLabel} unit`} value={unit} onChange={event => onUnitChange(row.key === 'Q' ? 'flow' : 'pressure', event.target.value)}>{options.map(option => <option key={option} value={option}>{option}</option>)}</select> : <span aria-label={row.unit === '—' ? 'dimensionless' : undefined}>{service === 'gas' ? row.gasUnit ?? row.unit : row.unit}</span>}
      </td>
      {CONDITIONS.map(({ key, label }) => {
        const id = `${service}-${key}-${row.key}`;
        const error = errors[key]?.[row.key];
        return (
          <td key={key} className={`input-cell ${key === 'normal' ? 'normal-cell' : ''}`}>
            <span className="condition-input-label" aria-hidden="true">{label}</span>
            <input id={id} name={`${key}.${row.key}`} type="text" inputMode="decimal" autoComplete="off" spellCheck="false" maxLength={64} required value={data[key][row.key]} placeholder={row.key === 'T' && temperatureUnit === 'K' ? '293.15' : row.placeholder} aria-label={`${label} ${displayLabel}`} aria-invalid={Boolean(error)} aria-describedby={[`${service}-${row.key}-unit`, error ? `${id}-error` : null].filter(Boolean).join(' ')} onChange={(event) => onChange(key, row.key, event.target.value)} />
            <ErrorMessage id={`${id}-error`} message={error} />
          </td>
        );
      })}
    </tr>
  );
}
