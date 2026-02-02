import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Recruit from "./components/Recruit";
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
      {rows.map((recruit) => (
        <Recruit
          key={recruit.id}
          id={recruit.id}
          rs_name={recruit.rs_name}
          joined_at={recruit.joined_at}
          status={recruit.status}
          discord_name={recruit.discord_name}
        />
      ))}
    </div>
  );
}
