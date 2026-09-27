/**
 * @fileoverview Root router for public marketing routes and the authenticated app.
 * @author Samuel S. L.
 * @version 1.6.0
 * @since 2026-09-06
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 * All information contained herein is, and remains, the property of
 * Samuel S. L. and its suppliers, if any.
 *
 * The intellectual, technical, creative, and software concepts contained
 * herein are proprietary to Samuel S. L. and its suppliers and
 * are protected by copyright law, trade secret law, and other applicable
 * intellectual property laws in the Netherlands, the European Union, and
 * other foreign jurisdictions.
 *
 * Where applicable, such rights may be registered, recorded, or protected
 * with the competent authorities of the Government of the Netherlands,
 * the European Union, and/or other relevant jurisdictions.
 *
 * Dissemination of this information, reproduction of this material,
 * modification, distribution, disclosure, or commercial use is strictly
 * forbidden unless prior written permission is obtained from
 * Samuel S. L.
 *
 * @commercialUse Commercial use permitted only with prior written permission from Samuel S. L.
 *
 * DETAILED_DESCRIPTION:
 * - Declares public routes under PublicLayout, including Docs (/docs/:slug),
 *   Changelog and Terms
 * - Gates /app/* behind RequireAuth and DashboardLayout
 * - Falls unknown paths back to the home page
 */

import { Navigate, Route, Routes } from 'react-router-dom';
import { ChatPage } from './chat/ChatPage';
import { ChangelogPage } from './docs/ChangelogPage';
import { DocsPage } from './docs/DocsPage';
import { DashboardLayout } from './components/DashboardLayout';
import { PublicLayout } from './components/PublicLayout';
import { LandingPage } from './pages/public/landing/Landing';
import { OfferPage } from './pages/public/landing/Offer';
import { SubscribePage } from './pages/public/landing/Subscribe';
import { ConsentBanner } from './components/ConsentBanner';
import { ReauthDialog } from './components/ReauthDialog';
import { usePageTracking } from './lib/analytics';
import { AdminPage } from './pages/app/admin/Admin';
import { RequireAuth } from './components/RequireAuth';
import { BillingPage } from './pages/app/Billing';
import { CliLoginPage } from './pages/app/CliLogin';
import { KeysPage } from './pages/app/Keys';
import { OverviewPage } from './pages/app/Overview';
import { SettingsPage } from './pages/app/Settings';
import { SpendingPage } from './pages/app/Spending';
import { UsagePage } from './pages/app/Usage';
import { ContactPage } from './pages/public/Contact';
import { DownloadPage } from './pages/public/Download';
import { ForgotPasswordPage } from './pages/public/ForgotPassword';
import { HomePage } from './pages/public/Home';
import { LoginPage } from './pages/public/Login';
import { LoginMfaPage } from './pages/public/LoginMfa';
import { ModelsPage } from './pages/public/Models';
import { PricingPage } from './pages/public/Pricing';
import { ProductsPage } from './pages/public/Products';
import { ResetPasswordPage } from './pages/public/ResetPassword';
import { ResourcesPage } from './pages/public/Resources';
import { SignupPage } from './pages/public/Signup';
import { TermsPage } from './pages/public/Terms';

/**
 * Top-level route table for the Faelith Industries SPA.
 */
export function App() {
  usePageTracking();
  return (
    <>
    <ReauthDialog />
    <ConsentBanner />
    <Routes>
      {/* Campaign landings: distraction-free, outside the marketing chrome. */}
      <Route path="/lp" element={<LandingPage />} />
      <Route path="/lp/offer" element={<OfferPage />} />
      <Route path="/subscribe" element={<SubscribePage />} />
      <Route path="/lp/:product" element={<LandingPage />} />
      <Route path="/lp/:product/:variant" element={<LandingPage />} />
      <Route path="/lp/:product/:variant/:locale" element={<LandingPage />} />
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/:slug" element={<DocsPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/mfa" element={<LoginMfaPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/cli/login" element={<CliLoginPage />} />
        <Route element={<DashboardLayout />}>
          <Route path="/app" element={<OverviewPage />} />
          <Route path="/app/chat" element={<ChatPage />} />
          <Route path="/app/settings" element={<SettingsPage />} />
          <Route path="/app/keys" element={<KeysPage />} />
          <Route path="/app/usage" element={<UsagePage />} />
          <Route path="/app/spending" element={<SpendingPage />} />
          <Route path="/app/billing" element={<BillingPage />} />
          <Route path="/app/admin" element={<AdminPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
