import Icon from './Icon.jsx';

export default function FormulaPanel({ service }) {
  const gas = service === 'gas';
  const definitions = [
    ['Cv', 'Valve flow coefficient'], ['Q', gas ? 'Gas flow rate, SCFM' : 'Liquid flow rate, gpm'],
    ['SG', gas ? 'Gas specific gravity' : 'Specific gravity'], ['ΔP', 'Valve pressure drop, psi'],
    ...(gas ? [['Y', 'Expansion factor'], ['Z', 'Compressibility factor'], ['T', 'Temperature; reference only']] : []),
  ];
  return (
    <section className="panel formula-panel" id="methodology" aria-labelledby="formula-heading">
      <div className="section-heading"><div><h2 id="formula-heading">Formula & methodology</h2></div><Icon name="book" size={18} /></div>
      <div className="formula-content">
        <div className="equation-block"><span className="eyebrow">{gas ? 'GAS FORMULA · SIMPLIFIED' : 'LIQUID FORMULA'}</span><div className="equation" role="math" aria-label={gas ? 'Cv equals Q times the square root of SG divided by the product of pressure drop, Y, and Z' : 'Cv equals Q times square root of SG divided by pressure drop'}><span>Cv</span><span className="math-operator">=</span><span>Q</span><span className="math-operator">×</span><span className="radical">√</span><span className="fraction"><span>SG</span><span>{gas ? 'ΔP × Y × Z' : 'ΔP'}</span></span></div><p>where <strong>ΔP = P₁ − P₂</strong></p></div>
        <dl className="formula-definitions">{definitions.map(([symbol, definition]) => <div key={symbol}><dt>{symbol}</dt><dd>{definition}</dd></div>)}</dl>
      </div>
      {gas && <div className="engineering-notice"><Icon name="alert" size={18} /><p><strong>Simplified sizing method.</strong> Final industrial gas valve sizing should be verified using the applicable IEC/ISA control valve sizing standard and manufacturer data. Temperature and absolute-pressure effects are not modeled by this equation.</p></div>}
    </section>
  );
}
