import { Component, type ReactNode } from 'react';
import { EmptyState } from './States';
import { Button } from '../ui/Button';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error(error);
  }

  override render() {
    if (this.state.error) {
      return (
        <EmptyState
          mood="worried"
          title="Arre! Something broke on this screen 😭"
          body="It is not you, it is us. Reloading usually fixes it."
          action={<Button onClick={() => window.location.reload()}>Reload</Button>}
        />
      );
    }
    return this.props.children;
  }
}
