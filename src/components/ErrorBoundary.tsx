import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro inesperado na aplicação.'
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const isQuotaError = this.state.errorMessage.toLowerCase().includes('quota exceeded');
      return (
        <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <h2 className="text-lg font-extrabold text-white">
              {isQuotaError ? 'Limite diário do Firebase atingido' : 'Ocorreu um erro inesperado'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {isQuotaError
                ? 'A cota gratuita diária do Firestore foi excedida e será redefinida amanhã. Seus dados locais continuam seguros.'
                : 'Não foi possível concluir a operação de sincronização. Recarregue a página para continuar.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
