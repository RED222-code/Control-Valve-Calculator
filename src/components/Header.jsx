import Icon from './Icon.jsx';

export default function Header() {
  return (
    <header className="site-header">
      <div className="header-inner page-width">
        <a href="#" className="brand" aria-label="Control engineering tools home">
          <span className="brand-mark"><Icon name="valve" size={25} /></span>
          <span className="brand-name">CONTROL<span>ENGINEERING TOOLS</span></span>
        </a>
       </div>
    </header>
  );
}
