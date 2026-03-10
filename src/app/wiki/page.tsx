import React from 'react';
import { getWikiData } from '@/lib/docLoader';
import { WikiClientView } from './WikiClientView';

export default function WikiPage() {
  // Purely dynamic structure based on folder hierarchy
  const operatorSections = getWikiData('operator');
  const engineerSections = getWikiData('engineer');

  return (
    <WikiClientView
      initialOperatorSections={operatorSections}
      initialEngineerSections={engineerSections}
    />
  );
}
