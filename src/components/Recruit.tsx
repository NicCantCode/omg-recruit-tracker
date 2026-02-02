import "./Recruit.css";

type RecruitProps = {
  id: string;
  rs_name: string;
  joined_at: string;
  status: string;

  discord_name?: string;
};

export default function Recruit(props: RecruitProps) {
  return (
    <div>
      <p>
        <span>RS Name</span>: {props.rs_name} | <span>Joined</span>: {props.joined_at} | <span>Status</span>: {props.status}
      </p>
    </div>
  );
}
