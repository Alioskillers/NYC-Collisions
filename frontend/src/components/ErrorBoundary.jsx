import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { /* no-op */ }

  render() {
    if (this.state.hasError) return null; // hide the broken child instead of crashing
    return this.props.children;
  }
}