import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import './index.css';
import App from "./App";
import { GoogleOAuthProvider } from "@react-oauth/google";

const clientId = "640334461086-14msfhrn9sq8b75ena8f5q5ogn38o0pa.apps.googleusercontent.com";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>
);
