import { CONDITIONS, INPUT_ROWS } from '../data/serviceConfig.js';
import { formatCv, formatNumber } from '../utils/formatting.js';
import { parseNumericInput } from '../utils/validation.js';
import InputRow from './InputRow.jsx';
import Icon from './Icon.jsx';

function pressureDrop(data) {
  try {
    const difference = parseNumericInput(data.P1, 'Upstream pressure') - parseNumericInput(data.P2, 'Downstream pressure');
    return Number.isFinite(difference) && difference > 0 ? difference : null;
  } catch {
    return null;
  }
}

export default function SizingTable({ service, data, errors, results, temperatureUnit, onTemperatureUnitChange, units = {}, onUnitChange, onChange }) {
  return (
    <>
      <div className="table-scroll-hint"><Icon name="arrow" size={14} /> Scroll horizontally to view all conditions</div>
      <div className="table-scroll" role="region" aria-label="Operating conditions table" tabIndex={0}>
        <table className="sizing-table" role="table">
          <caption className="sr-only">{service === 'liquid' ? 'Liquid' : 'Gas'} service operating conditions. Each operating condition is calculated independently.</caption>
          <colgroup><col className="variable-col" /><col className="unit-col" /><col /><col /><col /></colgroup>
          <thead><tr><th scope="col">Variable</th><th scope="col">Unit</th>{CONDITIONS.map(({ key, label, detail }) => <th scope="col" key={key} className={key === 'normal' ? 'normal-heading' : ''}><span>{label}</span><small>{detail}</small></th>)}</tr></thead>
          <tbody role="rowgroup">
            {INPUT_ROWS.filter((row) => service === 'gas' || !row.gasOnly).map((row) => row.type === 'automatic' ? (
              <tr className="automatic-row" key={row.key}>
                <th scope="row"><span className="variable-name">{row.label}<span className="variable-symbol">{row.symbol}</span></span></th>
                <td className="unit-cell">{units.pressure ?? 'psi'}</td>
                {CONDITIONS.map(({ key, label }) => <td key={key} className={key === 'normal' ? 'normal-cell' : ''}><span className="condition-input-label" aria-hidden="true">{label}</span><div className="automatic-value"><output aria-label={`${label} pressure drop`}>{formatNumber(pressureDrop(data[key]))}</output><span>AUTO</span></div></td>)}
              </tr>
            ) : <InputRow key={row.key} {...{ row, service, data, errors, temperatureUnit, onTemperatureUnitChange, units, onUnitChange, onChange }} />)}
            <tr className={`cv-row ${results ? 'has-results' : ''}`}>
              <th scope="row"><span className="variable-name">Calculated Cv<span className="variable-symbol">Cv</span></span></th>
              <td className="unit-cell"><span aria-label="dimensionless">—</span></td>
              {CONDITIONS.map(({ key, label }) => <td key={key}><span className="condition-input-label" aria-hidden="true">{label}</span><output aria-label={`${label} calculated Cv`}>{formatCv(results?.[key]?.cv)}</output></td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {service === 'gas' && <p className="temperature-note" id="temperature-note"><Icon name="info" size={15} />Temperature is recorded for reference; it is not used in this simplified gas equation.</p>}
    </>
  );
}
