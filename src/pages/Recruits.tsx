import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Recruit = {
  id: string;
  rs_name: string;
  discord_name: string | null;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export default function Recruits() {
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const load = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("recruits")
        .select("id, rs_name, discord_name, status, notes, created_by, created_at, updated_at, deleted_at")
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
        setRecruits([]);
        setIsLoading(false);
        return;
      }

      setRecruits((data ?? []) as Recruit[]);
      setIsLoading(false);
    };

    void load();
  }, []);

  if (isLoading) return <div>Loading recruits...</div>;

  if (errorMessage) {
    return (
      <div>
        <div>Failed to load recruits:</div>
        <pre>{errorMessage}</pre>
      </div>
    );
  }

  return (
    <div>
      <h1>Recruits</h1>

      <pre style={{ whiteSpace: "pre-wrap" }}>
        {recruits.length === 0
          ? "No recruits found."
          : recruits
              .map((recruit) => {
                const notes = recruit.notes ? recruit.notes : "-";
                const discordName = recruit.discord_name ? recruit.discord_name : "-";
                return [
                  `RS Name: ${recruit.rs_name}`,
                  `Discord Name: ${discordName}`,
                  `Status: ${recruit.status}`,
                  `Notes: ${notes}`,
                  `Created: ${recruit.created_at}`,
                  `Updates: ${recruit.updated_at}`,
                  `ID: ${recruit.id}`,
                  "",
                ].join("\n");
              })
              .join("\n")}
      </pre>
    </div>
  );
}
