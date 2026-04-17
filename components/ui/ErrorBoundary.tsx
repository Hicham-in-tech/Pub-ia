"use client";

import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

/**
 * Last-ditch UI: if React crashes inside the kiosk tree we swap to a full-
 * screen "Touchez pour recommencer" card that reloads on tap. This is what
 * saves a public install from a black screen when something goes wrong.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(err: unknown) {
    console.error("[Rouda] unhandled:", err);
  }

  private reload = () => {
    window.location.reload();
  };

  override render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        onClick={this.reload}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-12 text-center"
        style={{ background: "var(--color-base-50)", color: "var(--color-ink)" }}
      >
        <span className="chip-sticker" style={{ background: "var(--color-signal)", color: "#fff" }}>
          Oups
        </span>
        <h1
          className="text-kiosk-xxl"
          style={{ fontFamily: "var(--font-display)", maxWidth: "16ch" }}
        >
          Touchez pour recommencer.
        </h1>
        <p
          className="text-kiosk-md"
          style={{ color: "var(--color-base-400)", maxWidth: "32ch" }}
        >
          آسفة، حدث شيء غير متوقع.
        </p>
      </div>
    );
  }
}
