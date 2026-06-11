import { Outlet } from 'react-router-dom';
import { SymphonyNav } from '@/components/symphony/SymphonyNav';

export default function SymphonyLayout() {
  return (
    <div data-surface="symphony" className="symphony-shell min-h-screen">
      <SymphonyNav />
      <main className="symphony-main">
        <div className="symphony-page pb-10 pt-5 md:pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
