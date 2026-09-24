import { useRef } from 'react';
import Icon from './Icon.jsx';

export default function ServiceSelector({ service, onChange }) {
  const refs = useRef([]);
  const services = ['liquid', 'gas'];

  function handleKeyDown(event, index) {
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = 1 - index;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = 1;
    if (next === undefined) return;
    event.preventDefault();
    onChange(services[next]);
    refs.current[next]?.focus();
  }

  return (
    <div className="service-toolbar">
      <div className="service-tabs" role="tablist" aria-label="Calculator service">
        {services.map((mode, index) => (
          <button key={mode} type="button" ref={(node) => { refs.current[index] = node; }} role="tab" id={`${mode}-tab`} aria-selected={service === mode} aria-controls={`${mode}-calculator`} tabIndex={service === mode ? 0 : -1} onKeyDown={(event) => handleKeyDown(event, index)} onClick={() => onChange(mode)} className={`service-tab ${service === mode ? 'is-active' : ''}`}>
            <Icon name={mode} size={19} />{mode === 'liquid' ? 'Liquid Service' : 'Gas Service'}
          </button>
        ))}
      </div>
    </div>
  );
}
