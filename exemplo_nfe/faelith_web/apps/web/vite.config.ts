/**
 * @fileoverview Vite 8 configuration for the Faelith Industries React SPA.
 * @author Samuel S. L.
 * @version 1.0.2
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
 * - Enables official @vitejs/plugin-react Fast Refresh
 * - Proxies /api, /auth, and /stripe to the local gateway without path rewrite
 * - Pins the dev server to port 5173
 */

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      // changeOrigin must stay false: the gateway's CSRF guard requires the
      // original Host (127.0.0.1:5173) to match PUBLIC_ORIGIN. With
      // changeOrigin:true the proxy rewrites Host to 127.0.0.1:8081 and every
      // mutating request returns 403 "csrf origin mismatch".
      '/api': { target: 'http://127.0.0.1:8081', changeOrigin: false },
      '/auth': { target: 'http://127.0.0.1:8081', changeOrigin: false },
      '/stripe': { target: 'http://127.0.0.1:8081', changeOrigin: false },
    },
  },
});
