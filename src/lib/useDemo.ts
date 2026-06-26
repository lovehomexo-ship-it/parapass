import { useAuth } from './auth';

export function useDemo() {
  const { isDemo } = useAuth();

  function blockIfDemo(): boolean {
    if (isDemo) {
      window.dispatchEvent(new CustomEvent('demo:blocked'));
      return true;
    }
    return false;
  }

  return { isDemo, blockIfDemo };
}
