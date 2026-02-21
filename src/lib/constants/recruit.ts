import type { RecruitStatus } from "../constants/recruitStatuses";

export type Recruit = {
  id: string;
  rs_name: string;
  discord_name: string | null;
  status: RecruitStatus;
  birthday: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  joined_at: string | null;
};
