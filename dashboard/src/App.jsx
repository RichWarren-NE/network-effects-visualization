import { useState } from 'react';
import { useData } from './contexts/DataContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TabContainer from './components/TabContainer';
import AboutModal from './components/AboutModal';
import ExportModal from './components/ExportModal';
import UserGuide from './components/UserGuide';
import './App.css';

export default function App() {
  const { loading, allLoaded } = useData();
  const [showAbout, setShowAbout] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-brand">
          <h2>Network Effects</h2>
          <p className="loading-sub">Film Mobility Visualisation Tool</p>
        </div>
        <div className="skeleton-dashboard">
          <div className="skeleton-header" />
          <div className="skeleton-body">
            <div className="skeleton-sidebar">
              <div className="skeleton-block" style={{ height: '100px' }} />
              <div className="skeleton-block" style={{ height: '200px' }} />
            </div>
            <div className="skeleton-main">
              <div className="skeleton-block" style={{ height: '32px', width: '300px' }} />
              <div className="skeleton-block" style={{ height: '100%' }} />
            </div>
          </div>
        </div>
        <p className="loading-status">Fetching visualisation data...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Header
        onAbout={() => setShowAbout(true)}
        onGuide={() => setShowGuide(true)}
      />
      <div className="dash-body">
        <Sidebar onExport={() => setShowExport(true)} />
        <main className="dash-main">
          <TabContainer />
        </main>
      </div>
      <footer className="dash-footer">
        Network Effects Research Project | Bath Spa University | 2025
      </footer>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showGuide && <UserGuide onClose={() => setShowGuide(false)} />}
    </div>
  );
}
