import { redirect } from 'next/navigation';
import { DEFAULT_COMMUNITY_SLUG } from '@/lib/community-shared';

// La web original es ahora la comunidad principal.
export default function Home() {
  redirect(`/${DEFAULT_COMMUNITY_SLUG}`);
}
