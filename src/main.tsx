import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import AuthenticationProvider from "./lib/auth/AuthenticationProvider.tsx";
import App from "./App.tsx";
import "./index.css";
import ProfileProvider from "./lib/profile/ProfileProvider.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthenticationProvider>
        <ProfileProvider>
          <App />
        </ProfileProvider>
      </AuthenticationProvider>
    </HashRouter>
  </React.StrictMode>,
);
