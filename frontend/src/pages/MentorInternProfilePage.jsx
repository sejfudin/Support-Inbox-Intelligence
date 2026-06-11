import { useParams } from 'react-router-dom';
import { InternProfileView } from '@/components/interns/InternProfileView';

export default function MentorInternProfilePage() {
  const { userId } = useParams();

  return (
    <InternProfileView
      userId={userId}
      backTo="/my-interns"
      backLabel="Back to my interns"
      kicker="Assigned intern"
    />
  );
}
