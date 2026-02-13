import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FilterProvider } from './contexts/FilterContext';
import { DataProvider } from './contexts/DataContext';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DataProvider>
      <FilterProvider>
        <App />
      </FilterProvider>
    </DataProvider>
  </StrictMode>,
);
