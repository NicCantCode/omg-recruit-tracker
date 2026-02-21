import RecruitUpsertModal from "./RecruitUpsertModal";
import type { EditRecruitModalProps } from "../../lib/propsManager";

export default function EditRecruitModal({ isOpen, recruit, onClose, onSaved }: EditRecruitModalProps) {
  if (!recruit) return null;

  return <RecruitUpsertModal mode="edit" isOpen={isOpen} onClose={onClose} onSaved={onSaved} initialRecruit={recruit} />;
}
