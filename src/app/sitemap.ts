import { MetadataRoute } from 'next';
import { getWikiData } from '@/lib/docLoader';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://www.input-output.cc';

    const baseRoutes = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 1,
        },
        {
            url: `${baseUrl}/dashboard`,
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        },
        {
            url: `${baseUrl}/wiki`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.5,
        },
    ];

    // Dynamic Wiki Routes
    const userSections = getWikiData('user');
    const developerSections = getWikiData('developer');

    const wikiRoutes = [
        ...userSections.map((section) => ({
            url: `${baseUrl}/wiki/user/${section.slug}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.6,
        })),
        ...developerSections.map((section) => ({
            url: `${baseUrl}/wiki/developer/${section.slug}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.6,
        })),
    ];

    return [...baseRoutes, ...wikiRoutes];
}
