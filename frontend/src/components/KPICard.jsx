import { Card, CardContent, Typography } from "@mui/material";

export default function KPICard({ title, value }) {
  const fmt = (n) => (n==null ? "—" : Intl.NumberFormat("en-US").format(n));
  return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        <Typography sx={{ opacity: 0.8, fontWeight: 700 }}>{title}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>{fmt(value)}</Typography>
      </CardContent>
    </Card>
  );
}