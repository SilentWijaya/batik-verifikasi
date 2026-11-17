
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import "./index.css";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import User from "./pages/User.jsx";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
  <Route path="/" element={<Login />} />
  <Route path="/admin" element={<App />} />
  <Route path="/user" element={<User />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
    </BrowserRouter>
  </StrictMode>
);
