import { useState, useEffect } from 'react';
import { checkAuthStatus, getGitHubLoginUrl, logoutUser } from './apiClient';
import type { AuthStatusResponse } from './apiClient';

export function useAuth() {
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadAuth() {
      try {
        const status = await checkAuthStatus();
        if (mounted) setAuthStatus(status);
      } catch (err) {
        console.error('Failed to load auth status', err);
        if (mounted) setAuthStatus({ authenticated: false, github_user: null });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = () => {
    window.location.href = getGitHubLoginUrl();
  };

  const logout = async () => {
    try {
      await logoutUser();
      setAuthStatus({ authenticated: false, github_user: null });
    } catch (err) {
      console.error('Failed to logout', err);
    }
  };

  return {
    isAuthenticated: authStatus?.authenticated ?? false,
    user: authStatus?.github_user ?? null,
    isLoading,
    login,
    logout,
  };
}
