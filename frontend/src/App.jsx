// frontend/src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Box } from "@mui/material";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import AppHeader from "./components/AppHeader";
import Home from "./pages/Home";
import Analytics from "./pages/Analytics";
import AccidentMap from "./pages/AccidentMap"; // ⬅️ NEW

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <AppHeader />
      <Box
        component="main"
        sx={{
          bgcolor: "#ffffff",
          minHeight: "100vh",
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/map" element={<AccidentMap />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </>
  );
}