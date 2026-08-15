export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default function DeveloperPage() {
  redirect('/developer/overview');
}
