import FilterControls from './FilterControls';
import QuickStats from './QuickStats';

export default function Sidebar({ onExport }) {
  return (
    <aside className="sidebar">
      <QuickStats />
      <FilterControls />
      <div className="sidebar-actions">
        <button className="export-btn" onClick={onExport}>Export Data</button>
      </div>
    </aside>
  );
}
