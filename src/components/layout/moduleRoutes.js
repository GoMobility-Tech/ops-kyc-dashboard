// Frontend routing convention — maps backend `modules[].key` → app route.
// Silently skip unknown module keys (backend may ship new modules ahead of the frontend).

export const MODULE_ROUTES = {
  my_drivers:  '/my-drivers',
  all_drivers: '/all-drivers',
  logs:        '/logs',
};

export const routeFor = (moduleKey) => MODULE_ROUTES[moduleKey];

export const isKnownModule = (moduleKey) => Boolean(MODULE_ROUTES[moduleKey]);

// First navigable route from an ordered modules[] array.
// Falls back to /my-drivers (which itself will route-guard if not granted).
export const firstAvailableRoute = (modules = []) => {
  const first = modules.find(m => isKnownModule(m.key));
  return first ? MODULE_ROUTES[first.key] : '/my-drivers';
};
