import { Component, type ReactNode } from 'react';

type Props = { children?: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component {
  declare props: Props;
  declare state: State;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
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
        <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-8 font-sans text-[#141414]">
          <div className="bg-white border border-[#141414] p-8 max-w-md w-full text-center">
            <h1 className="text-xl font-bold uppercase tracking-tighter mb-2">Произошла ошибка</h1>
            <p className="text-sm opacity-70 mb-6">
              Не удалось отобразить страницу. Попробуйте обновить её или вернуться на главную.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a
                href="/"
                className="border border-[#141414] px-4 py-2 text-sm font-bold uppercase hover:bg-black/5"
              >
                На главную
              </a>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="bg-[#141414] text-white px-4 py-2 text-sm font-bold uppercase hover:bg-black/80"
              >
                Обновить страницу
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
