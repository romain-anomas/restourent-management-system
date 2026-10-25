import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowRight, FiGrid, FiUsers } from 'react-icons/fi';
import { useCart } from '../../context/CartContext';
import { tableService } from '../../services/tableService';
import { formatTableLabel } from '../../utils/format';

const tableColors = {
  AVAILABLE: 'border-emerald-300 bg-emerald-100 text-emerald-900',
  OCCUPIED: 'border-red-300 bg-red-100 text-red-900',
  ORDERING: 'border-red-300 bg-red-100 text-red-900',
  PAYMENT_PENDING: 'border-orange-300 bg-orange-100 text-orange-900',
  RESERVED: 'border-sky-300 bg-sky-100 text-sky-900',
};

const tableStatusLabels = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied · ordering closed',
  ORDERING: 'Occupied · ordering closed',
  PAYMENT_PENDING: 'Occupied · payment pending',
  RESERVED: 'Reserved',
};

function autoPositions(count) {
  const positions = [];
  const leftCount = Math.ceil(count * 0.4);
  const centerCount = Math.min(count - leftCount, Math.ceil(count * 0.25));
  const rightCount = count - leftCount - centerCount;

  for (let i = 0; i < leftCount; i += 1) {
    positions.push({ area: 'left' });
  }
  for (let i = 0; i < centerCount; i += 1) {
    positions.push({ area: 'center' });
  }
  for (let i = 0; i < rightCount; i += 1) {
    positions.push({ area: 'right' });
  }
  return positions;
}

export default function Seating() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const { selectedTable, setSelectedTable, activeTableSession, setActiveTableSession } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    tableService.getPublicTables()
      .then((result) => {
        if (!active) return;
        setTables(result || []);
        const ownSessionTable = (result || []).find((table) => Number(table.id) === Number(activeTableSession?.table?.id)
          && Number(table.session_id) === Number(activeTableSession?.sessionId));
        if (ownSessionTable) {
          setSelected(ownSessionTable.id);
          setSelectedTable(ownSessionTable);
          return;
        }
        if (activeTableSession) {
          setActiveTableSession(null);
          setSelectedTable(null);
          toast('Your previous table session has ended. Choose an available table to start again.');
        }
        const match = (result || []).find((table) => Number(table.id) === Number(selectedTable?.id)
          && table.status === 'AVAILABLE' && !table.session_id);
        if (match) setSelected(match.id);
        else if (selectedTable) setSelectedTable(null);
      })
      .catch(() => active && toast.error('Could not load the seating plan.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const chooseTable = (table) => {
    if (activeTableSession && Number(activeTableSession.table?.id) !== Number(table.id)) {
      toast.error('Finish your current table session before choosing another table.');
      return;
    }
    setSelected(table.id);
    setSelectedTable(table);
  };

  const continueToMenu = () => {
    if (activeTableSession && Number(activeTableSession.table?.id) === Number(selected)) {
      navigate('/menu');
      return;
    }
    const table = tables.find((item) => Number(item.id) === Number(selected)
      && item.status === 'AVAILABLE' && !item.session_id);
    if (!table) return toast.error('Choose an available table to continue.');
    setSelectedTable(table);
    navigate('/menu');
  };

  const positions = autoPositions(tables.length);
  const positionedTables = tables.map((table, index) => {
    const x = Number(table.position_x);
    const y = Number(table.position_y);
    const hasSavedPosition = table.position_x != null && table.position_y != null
      && Number.isFinite(x) && Number.isFinite(y) && (x !== 0 || y !== 0);
    const fallback = positions[index] || { area: 'left' };
    const savedArea = String(table.section || '').toLowerCase();
    const area = savedArea.includes('left') ? 'left'
      : savedArea.includes('right') ? 'right'
        : savedArea.includes('main') ? 'center'
          : hasSavedPosition ? (x < 38 ? 'left' : (y >= 62 || (x >= 38 && x < 67) ? 'center' : 'right')) : fallback.area;
    return {
      ...table,
      area,
    };
  });
  const tablesByArea = {
    left: positionedTables.filter((table) => table.area === 'left'),
    center: positionedTables.filter((table) => table.area === 'center'),
    right: positionedTables.filter((table) => table.area === 'right'),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700"><FiGrid /> Dine in</span>
        <h1 className="mt-4 text-3xl font-bold text-ink-900">Choose your table</h1>
        <p className="mt-2 text-sm text-gray-500">Select a green available table on the restaurant map. Occupied and reserved tables are shown but can’t be selected.</p>
      </div>

      {loading ? (
        <div className="mt-10 h-[420px] animate-pulse rounded-3xl bg-gray-100" />
      ) : tables.length === 0 ? (
        <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <p className="font-semibold text-ink-900">No tables are available for online ordering yet.</p>
          <p className="mt-2 text-sm text-gray-500">Please ask a team member to help you place your order.</p>
          <Link to="/menu" className="mt-5 inline-flex text-sm font-semibold text-brand-600">Browse menu <FiArrowRight className="ml-1" /></Link>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs font-medium text-gray-600">
            {[
              ['bg-emerald-100 border-emerald-300', 'Available'],
              ['bg-red-100 border-red-300', 'Occupied'],
              ['bg-orange-100 border-orange-300', 'Payment pending'],
              ['bg-sky-100 border-sky-300', 'Reserved'],
            ].map(([color, label]) => <span key={label} className="inline-flex items-center gap-2"><i className={`h-3 w-3 rounded-full border ${color}`} />{label}</span>)}
          </div>

          <div className="restaurant-floorplan">
            {[
              ['left', 'Left dining area'],
              ['center', 'Main dining area'],
              ['right', 'Right dining area'],
            ].map(([area, title]) => (
              <section key={area} className={`floorplan-zone floorplan-zone-${area}`}>
                <h2 className="floorplan-zone-title">{title}</h2>
                <div className="floorplan-tables">
                  {tablesByArea[area].map((table) => {
              const isSelected = Number(selected) === Number(table.id);
              const isAvailable = table.status === 'AVAILABLE' && !table.session_id;
              const isOwnSession = Number(activeTableSession?.table?.id) === Number(table.id)
                && Number(activeTableSession?.sessionId) === Number(table.session_id);
              const color = tableColors[table.status] || tableColors.AVAILABLE;
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={(!isAvailable && !isOwnSession) || (activeTableSession && !isOwnSession)}
                  onClick={() => chooseTable(table)}
                  aria-label={`${formatTableLabel(table)}, ${tableStatusLabels[table.status] || table.status}, up to ${table.capacity} guests`}
                  title={`${formatTableLabel(table)} · ${tableStatusLabels[table.status] || table.status}`}
                  className={`floorplan-table flex flex-col items-center justify-center rounded-xl border-2 px-1 text-xs font-bold leading-tight shadow-sm transition ${color} ${isSelected ? 'scale-105 ring-4 ring-brand-300' : ''} ${isAvailable ? 'cursor-pointer hover:scale-105 hover:shadow-md' : 'cursor-not-allowed opacity-80'}`}
                >
                  <span className="floorplan-table-number">{table.table_number}</span>
                  <span className="max-w-full truncate text-[9px] font-medium">{isOwnSession ? 'Your table' : isSelected ? 'Selected' : table.status === 'AVAILABLE' ? 'Available' : table.status === 'RESERVED' ? 'Reserved' : 'Occupied'}</span>
                </button>
              );
                  })}
                  {tablesByArea[area].length === 0 && <p className="floorplan-empty">No tables in this area</p>}
                </div>
              </section>
            ))}
          </div>

          <div className="mx-auto mt-4 grid max-w-5xl grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {positionedTables.map((table) => <span key={table.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs text-gray-600"><FiUsers className="shrink-0" size={13} /><span className="min-w-0 flex-1 truncate">{formatTableLabel(table)}</span><span className={`shrink-0 font-semibold ${table.status === 'AVAILABLE' ? 'text-emerald-700' : table.status === 'RESERVED' ? 'text-sky-700' : table.status === 'PAYMENT_PENDING' ? 'text-orange-700' : 'text-red-700'}`}>{tableStatusLabels[table.status] || table.status}</span></span>)}
          </div>

          <div className="mx-auto mt-7 flex max-w-xl items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
            <p className="pl-2 text-sm text-gray-600">{selected ? `${formatTableLabel(tables.find((table) => Number(table.id) === Number(selected)))} selected` : 'Select an available table to start'}</p>
            <button type="button" onClick={continueToMenu} disabled={!selected} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">Browse menu <FiArrowRight /></button>
          </div>
        </>
      )}
    </div>
  );
}
