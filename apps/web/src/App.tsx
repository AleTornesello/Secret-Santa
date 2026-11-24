import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DesignShowcase } from './design/DesignShowcase';
import { I18nProvider, type Locale } from './i18n/I18nProvider';
import { ComingSoon } from './pages/ComingSoon';
import { Dashboard } from './pages/Dashboard';
import { Home } from './pages/Home';
import { NewGroup } from './pages/NewGroup';

/**
 * Hash routes, because GitHub Pages has no fallback for deep links. Everything after `#`,
 * tokens included, stays in the browser.
 */
export function App({ locale }: { locale?: Locale }) {
  return (
    <I18nProvider initial={locale}>
      <HashRouter>
        <Routes>
          <Route path="/design" element={<DesignShowcase />} />
          <Route
            path="*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/new" element={<NewGroup />} />
                  <Route path="/g/:groupId" element={<Dashboard />} />
                  <Route path="/g/:groupId/me" element={<ComingSoon screen="mine" />} />
                  <Route path="/join/:code" element={<ComingSoon screen="join" />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </HashRouter>
    </I18nProvider>
  );
}
