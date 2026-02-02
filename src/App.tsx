import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./App.css";

type Recruit = {
  id: string;
  rs_name: string;
  joined_at: string;
  status: string;

  discord_name?: string;
};

export default function App() {
  const [rows, setRows] = useState<Recruit[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("recruits")
        .select("id, rs_name, joined_at, status, discord_name")
        .order("joined_at", { ascending: false });

      if (error) setError(error.message);
      else setRows(data ?? []);
    })();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h1>Recruit Tracker</h1>
      {error && <p>Error: {error}</p>}
      <pre>{JSON.stringify(rows, null, 2)}</pre>
    </div>
  );
}
