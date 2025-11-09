import { useState } from "react";
import { TextField, Button, Stack } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

export default function SearchBar({ onParsed }) {
  const [q, setQ] = useState("");

  async function submit(e) {
    e.preventDefault();
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await r.json();
    onParsed(data.parsed || {});
  }

  return (
    <form onSubmit={submit}>
      <Stack direction="row" spacing={1.5}>
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          placeholder="Try: Brooklyn 2022 pedestrian"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" variant="contained" startIcon={<SearchIcon />}>
          Search
        </Button>
      </Stack>
    </form>
  );
}