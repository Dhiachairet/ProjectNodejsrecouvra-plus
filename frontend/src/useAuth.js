import { createContext, useContext } from 'react';

// Kept apart from AuthProvider so auth.jsx exports only a component, which React fast refresh needs.
export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);
