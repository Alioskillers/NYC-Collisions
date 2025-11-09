import { AppBar, Toolbar, Typography, Box } from "@mui/material";
import InsightsIcon from "@mui/icons-material/Insights";

export default function AppHeader() {
  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{ borderBottom: "1px solid #e5e7eb", backdropFilter: "none" }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <InsightsIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          NYC Collision Analytics
        </Typography>
      </Toolbar>
    </AppBar>
  );
}