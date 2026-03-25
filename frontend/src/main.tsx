import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import "./index.css";

const clientId =
  "640334461086-14msfhrn9sq8b75ena8f5q5ogn38o0pa.apps.googleusercontent.com";

// Temporary: auto-set Admin role for testing until login is built
if (!localStorage.getItem('role')) localStorage.setItem('role', 'Admin');

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <GoogleOAuthProvider clientId={clientId}>
        <App />
      </GoogleOAuthProvider>
    </BrowserRouter>
  </StrictMode>
);