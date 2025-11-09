import { Box, Skeleton } from "@mui/material";

export default function LoadingBox({ rows = 6 }) {
  return (
    <Box sx={{ p: 1 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={24} sx={{ mb: 1, bgcolor: "rgba(255,255,255,0.06)" }} />
      ))}
    </Box>
  );
}