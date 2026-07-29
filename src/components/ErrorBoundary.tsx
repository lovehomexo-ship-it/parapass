import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; purging: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, purging: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, purging: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  // Rechargement AUTO-RÉPARANT : purge le service worker + tous les caches avant
  // de recharger. Corrige les crashs de type « chunk périmé » (React #130 : un
  // composant lazy résout à `undefined` quand un vieux index.html référence des
  // bundles remplacés) — fréquent sur PWA iOS installée sur l'écran d'accueil.
  recover = async () => {
    this.setState({ purging: true });
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      // Gestion explicite : on n'empêche jamais le rechargement de secours.
      console.error('[ErrorBoundary] purge du cache échouée :', e);
    } finally {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="flex justify-center mb-4"><AlertTriangle className="w-10 h-10 text-amber-500" aria-hidden /></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Une erreur est survenue</h2>
            <p className="text-sm text-gray-500 mb-6">
              {this.state.error?.message ?? 'Erreur inattendue'}
            </p>
            <button
              onClick={this.recover}
              disabled={this.state.purging}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: '#2563EB' }}
            >
              {this.state.purging ? 'Nettoyage…' : 'Vider le cache et recharger'}
            </button>
            <p className="text-[11px] text-gray-400 mt-3">Recharge une version propre de l'app.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
