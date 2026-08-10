import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import "./index.css";

const clientId =
  "640334461086-14msfhrn9sq8b75ena8f5q5ogn38o0pa.apps.googleusercontent.com";

const rootElement = document.getElementById("root");

console.log("ROOT =", rootElement);

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <GoogleOAuthProvider clientId={clientId}>
        <App />
      </GoogleOAuthProvider>
    </BrowserRouter>
  </StrictMode>
);