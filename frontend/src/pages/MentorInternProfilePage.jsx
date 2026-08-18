import { useParams } from 'react-router-dom';
import { InternProfileView } from '@/components/interns/InternProfileView';
import { useIntern } from '@/queries/interns';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function MentorInternProfilePage() {
  const { userId } = useParams();
  // Same query the profile view runs, read here only for the tab title.
  const { data: intern } = useIntern(userId);
  useDocumentTitle(intern?.user?.fullname);

  return <InternProfileView userId={userId} backTo="/my-interns" backLabel="Back to my interns" />;
}
