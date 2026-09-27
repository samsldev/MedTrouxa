/**
 * @fileoverview Route guard that requires GET /auth/me before dashboard pages.
 * @author Samuel S. L.
 * @version 1.1.0
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
 * - Waits for the initial session fetch
 * - Redirects unauthenticated visitors to /login
 * - Renders nested dashboard routes when a session exists
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useT, type Dict } from '../lib/i18n';

const LOADING: Dict<string> = { en: 'Loading session…', br: 'Carregando sessão…', pt: 'A carregar a sessão…' };

/**
 * Blocks /app/* until a session user is present.
 */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const loadingText = useT(LOADING);
  if (loading) {
    return <p className="page">{loadingText}</p>;
  }
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}
