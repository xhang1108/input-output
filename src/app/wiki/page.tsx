import { Metadata } from 'next';
import { getWikiData } from '@/lib/docLoader';
import { WikiClientView } from './WikiClientView';

export async function generateMetadata(): Promise<Metadata> {
  // We can't know the exact active item on server side without URL params
  // but we can set a better default title
  return {
    title: 'Wiki | Input-Output',
    description: 'Documentation for the Input-Output engineering system, covering both user guides and developer specifications.',
    keywords: ['Input-Output', 'Engineering', 'Wiki', 'Documentation', 'Visual Programming'],
  };
}

export default function WikiPage() {
  // Purely dynamic structure based on folder hierarchy
  const userSections = getWikiData('user');
  const developerSections = getWikiData('developer');

  return (
    <WikiClientView
      initialUserSections={userSections}
      initialDeveloperSections={developerSections}
    />
  );
}
