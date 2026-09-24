import Header from './components/Header.jsx';
import ValveSizing from './pages/ValveSizing.jsx';

export default function App() {
  return (
    <>
      <a className="skip-link" href="#calculator">Skip to calculator</a>
      <Header />
      <ValveSizing />
      <footer className="site-footer page-width">
        <span>CONTROL <span className="footer-divider">/</span> Engineering tools</span>
      </footer>
    </>
  );
}
