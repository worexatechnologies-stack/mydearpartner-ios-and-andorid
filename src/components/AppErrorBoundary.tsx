import React from 'react';
import EmptyState from './EmptyState';

/** Keep render failures recoverable without exposing internal error details. */
export default class AppErrorBoundary extends React.Component<
  { children: React.ReactNode }, { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return <EmptyState icon="refresh-outline" title="Something went wrong"
        description="Try reopening this screen. Your saved account is still available."
        buttonText="Try again" onButtonPress={() => this.setState({ failed: false })} />;
    }
    return this.props.children;
  }
}
