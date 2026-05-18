'use client';

import { countryRepHttp } from '@/lib/api/client';
import { createRoleAuth } from './factory';

// Auth context for the country-representative portal. A representative is an
// admin-created account that manages one country's students for a competition's
// local round. Sign-in happens at the unified `/` route; this context only
// gates the `/rep-portal` pages.
const { Provider, useHook } = createRoleAuth({
  http: countryRepHttp,
  acceptRole: (role) => role === 'country_representative',
  hookName: 'useCountryRepAuth',
  deniedMessage:
    'This portal is for country representatives. Sign in from the home page to land on the right workspace.',
});

export const CountryRepAuthProvider = Provider;
export const useCountryRepAuth = useHook;
