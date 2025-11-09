import { Card, CardContent, Typography } from "@mui/material";

export default function Section({ title, subtitle, children, sx }) {
  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5, ...sx }}>
      <CardContent sx={{ p: 2.5 }}>
        {title && (
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        )}
        {subtitle && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            {subtitle}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
}