import { Metadata } from 'next';
import { getWikiData } from '@/lib/docLoader';
import { WikiClientView } from '../WikiClientView';

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sectionSlug = slug?.[0];
  
  return {
    title: sectionSlug 
      ? `${sectionSlug.charAt(0).toUpperCase() + sectionSlug.slice(1)} | Wiki | Input-Output`
      : 'Wiki | Input-Output',
    description: 'Documentation for the Input-Output engineering system.',
  };
}

export async function generateStaticParams() {
  const userSections = getWikiData('user');
  const developerSections = getWikiData('developer');
  
  const params: { slug: string[] }[] = [];
  
  // Base paths
  params.push({ slug: [] }); 
  params.push({ slug: ['user'] }); 
  params.push({ slug: ['developer'] }); 
  
  // Section paths (This is what the UI actually navigates to)
  userSections.forEach(section => {
    params.push({ slug: ['user', section.slug] });
  });
  
  developerSections.forEach(section => {
    params.push({ slug: ['developer', section.slug] });
  });

  return params;
}

export const dynamicParams = false;

export default async function WikiPage({ params }: PageProps) {
  const { slug } = await params;
  const mode = slug?.[0] || 'user';
  const initialSlug = slug?.[1];
  
  // Purely dynamic structure based on folder hierarchy
  const userSections = getWikiData('user');
  const developerSections = getWikiData('developer');

  return (
    <WikiClientView
      initialUserSections={userSections}
      initialDeveloperSections={developerSections}
      initialSlug={initialSlug}
      initialMode={mode as any}
    />
  );
}
