import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './Layout';

const TeamsPage = lazy(() => import('@/modules/team-builder/pages/TeamsPage'));
const MatchupPage = lazy(() => import('@/modules/matchup-tool/pages/MatchupPage'));
const MetaPage = lazy(() => import('@/modules/meta-dashboard/pages/MetaPage'));
const GuidesPage = lazy(() => import('@/modules/battle-guides/pages/GuidesPage'));
const DataPage = lazy(() => import('@/modules/data-manager/pages/DataPage'));

function LazyWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading...</div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/teams" replace /> },
      {
        path: 'teams',
        element: <LazyWrapper><TeamsPage /></LazyWrapper>,
      },
      {
        path: 'matchup',
        element: <LazyWrapper><MatchupPage /></LazyWrapper>,
      },
      {
        path: 'meta',
        element: <LazyWrapper><MetaPage /></LazyWrapper>,
      },
      {
        path: 'guides',
        element: <LazyWrapper><GuidesPage /></LazyWrapper>,
      },
      {
        path: 'data',
        element: <LazyWrapper><DataPage /></LazyWrapper>,
      },
    ],
  },
], {
  // Respect the deployment base path (root or a GitHub Pages subpath).
  basename: import.meta.env.BASE_URL,
});
