import { lazy, Suspense } from 'react';
import { useLenis } from './lib/lenis';
import { useCardMotion } from './lib/cardMotion';
import { usePathname, NotFoundPage, PlaceholderRoute } from './lib/router';

import Navbar from './components/Navbar';
import CursorGlow from './components/CursorGlow';
import LivingBackground from './components/LivingBackground';
import ErrorBoundary from './components/ErrorBoundary';
import LazySection from './components/LazySection';
import Hero from './components/Hero';

// Code-split below-the-fold sections to eliminate initial Total Blocking Time (TBT)
const WhyItMatters = lazy(() => import('./components/WhyItMatters'));
const TheProblem = lazy(() => import('./components/TheProblem'));
const Pipeline = lazy(() => import('./components/Pipeline'));
const VmdSection = lazy(() => import('./components/VmdSection'));
const FeaturesSection = lazy(() => import('./components/FeaturesSection'));
const ModelSection = lazy(() => import('./components/ModelSection'));
const LimitsSection = lazy(() => import('./components/LimitsSection'));
const ProgressTracker = lazy(() => import('./components/ProgressTracker'));
const Footer = lazy(() => import('./components/Footer'));

export default function App() {
  const pathname = usePathname();
  // Initialize butter-smooth Lenis scroll
  useLenis();
  // Initialize shared card spotlight & staggered scroll entrances
  useCardMotion();

  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const isHome = normalizedPath === '/' || normalizedPath === '/index.html';

  return (
    <div className="nilm-app-root">
      <LivingBackground />
      <CursorGlow />
      <Navbar />

      {!isHome ? (
        normalizedPath === '/estimator' ? (
          <PlaceholderRoute title="NILM Load Estimator" />
        ) : normalizedPath === '/dashboard' ? (
          <PlaceholderRoute title="NILM Telemetry Dashboard" />
        ) : (
          <NotFoundPage />
        )
      ) : (
        <main id="main-content" tabIndex={-1}>
        {/* Tier 1 Master Flow */}
        <ErrorBoundary name="Hero">
          <Hero />
        </ErrorBoundary>

        <Suspense fallback={<div className="section-loading-placeholder" style={{ minHeight: '50vh' }} />}>
          <LazySection sectionKey="why" targetId="why-it-matters-heading">
            <ErrorBoundary name="Why It Matters">
              <WhyItMatters />
            </ErrorBoundary>
          </LazySection>
          
          <LazySection sectionKey="problem" targetId="the-problem-heading">
            <ErrorBoundary name="The Problem">
              <TheProblem />
            </ErrorBoundary>
          </LazySection>

          <LazySection sectionKey="pipeline" targetId="pipeline-heading" eagerOnDesktop={true}>
            <ErrorBoundary name="Pipeline">
              <Pipeline />
            </ErrorBoundary>
          </LazySection>

          <LazySection sectionKey="vmd" targetId="vmd-heading">
            <ErrorBoundary name="VMD">
              <VmdSection />
            </ErrorBoundary>
          </LazySection>

          <LazySection sectionKey="features" targetId="features-heading">
            <ErrorBoundary name="Features">
              <FeaturesSection />
            </ErrorBoundary>
          </LazySection>

          <LazySection sectionKey="model" targetId="model-heading">
            <ErrorBoundary name="Model">
              <ModelSection />
            </ErrorBoundary>
          </LazySection>

          <LazySection sectionKey="limits" targetId="limits-heading">
            <ErrorBoundary name="Limits">
              <LimitsSection />
            </ErrorBoundary>
          </LazySection>

          <LazySection sectionKey="tracker" targetId="tracker-heading">
            <ErrorBoundary name="Progress Tracker">
              <ProgressTracker />
            </ErrorBoundary>
          </LazySection>
        </Suspense>
      </main>
      )}

      <Suspense fallback={null}>
        <LazySection sectionKey="footer" minHeight="280px">
          <ErrorBoundary name="Footer">
            <Footer />
          </ErrorBoundary>
        </LazySection>
      </Suspense>
    </div>
  );
}
