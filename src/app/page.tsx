import { redirect } from 'next/navigation';

// No landing page: the app opens on the template list, or on login.
export default function Home() {
  redirect('/templates');
}
