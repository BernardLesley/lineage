import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "reactflow/dist/style.css";
import "./index.css";

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    if (
      event.message ===
        "ResizeObserver loop completed with undelivered notifications." ||
      event.message === "ResizeObserver loop limit exceeded"
    ) {
      event.stopImmediatePropagation();

      const overlayDiv = document.getElementById(
        "webpack-dev-server-client-overlay-div"
      );
      const overlayIframe = document.getElementById(
        "webpack-dev-server-client-overlay"
      );

      if (overlayDiv) overlayDiv.remove();
      if (overlayIframe) overlayIframe.remove();
    }
  });
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(<App />);
