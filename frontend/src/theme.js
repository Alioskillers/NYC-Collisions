import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    background: { default: "#ffffff", paper: "#f7f7f9" },
    primary: { main: "#1e88e5" },
    secondary: { main: "#43a047" },
    text: { primary: "#111", secondary: "#555" }
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: `'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans"`,
    h4: { fontWeight: 800, letterSpacing: 0.4 }
  },
  components: {
    MuiCard: { styleOverrides: { root: { border: "1px solid #e5e7eb" } } }
  }
});

export default theme;