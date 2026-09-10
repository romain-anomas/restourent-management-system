import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { settingsService } from '../services/settingsService';

export default function PublicLayout() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    settingsService
      .getPublic()
      .then(setSettings)
      .catch(() => setSettings(null)); // Non-fatal - pages fall back to sensible defaults
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicNavbar restaurantName={settings?.restaurant_name} />
      <main className="flex-1">
        <Outlet context={{ settings }} />
      </main>
      <PublicFooter settings={settings} />
    </div>
  );
}
