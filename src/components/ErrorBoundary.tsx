import { Component, type ReactNode } from 'react';

type Props = { children?: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-page flex items-center justify-center p-8 font-sans text-ink">
          <div className="bg-surface border border-line p-8 max-w-md w-full text-center">
            <h1 className="text-xl font-bold uppercase tracking-tighter mb-2">Произошла ошибка</h1>
            <p className="text-sm opacity-70 mb-6">
              Не удалось отобразить страницу. Попробуйте обновить её или вернуться на главную.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a
                href="/"
                className="btn-brutal"
              >
                На главную
              </a>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-brutal btn-brutal-primary"
              >
                Обновить страницу
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as unknown as { props: Props }).props.children;
  }
}
