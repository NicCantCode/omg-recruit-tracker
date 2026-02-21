import RecruitUpsertModal from "./RecruitUpsertModal";
import type { CreateRecruitModalProps } from "../../lib/propsManager";

export default function CreateRecruitModal({ isOpen, onClose, onSaved }: CreateRecruitModalProps) {
  return <RecruitUpsertModal mode="create" isOpen={isOpen} onClose={onClose} onSaved={onSaved} />;
}
