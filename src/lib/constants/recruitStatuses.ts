export const RECRUIT_STATUSES = [
  "guesting",
  "potential recruit",
  "new recruit",
  "reach out",
  "follow up",
  "core member",
  "banned",
  "deleted",
] as const;

export type RecruitStatus = (typeof RECRUIT_STATUSES)[number];
export const STATUS_FILTER_OPTIONS = ["all", ...RECRUIT_STATUSES] as const;
export type StatusFilter = (typeof STATUS_FILTER_OPTIONS)[number];
