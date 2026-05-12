import type { Metadata } from 'next';
import PolicyPage from '@/app/components/PolicyPage';

export const metadata: Metadata = {
  title: 'Privacy Policy – VEIRO',
  description: 'Privacy Policy for VEIRO.',
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy Policy – VEIRO"
      updated="Last updated: May 2026"
      intro={[
        'VEIRO is a private beta application focused on running analysis and AI-powered training insights.',
        'By using VEIRO, you acknowledge and accept the collection and processing of certain personal and activity-related data as described below.',
      ]}
      sections={[
        {
          title: '1. Data collected',
          paragraphs: ['When using VEIRO, the application may collect and process:'],
          bullets: [
            'Strava account information authorized through OAuth',
            {
              text: 'Running activity data from Strava, including:',
              children: [
                'distance',
                'duration',
                'pace',
                'heart rate',
                'elevation',
                'activity date and title',
              ],
            },
            'User profile information voluntarily provided',
            'Technical and diagnostic information required to operate the service',
          ],
          afterBullets: ['VEIRO only accesses data explicitly authorized by the user through Strava.'],
        },
        {
          title: '2. How data is used',
          paragraphs: ['Collected data is used exclusively to:'],
          bullets: [
            'synchronize running activities',
            'generate AI-based training insights and summaries',
            'improve the running coach experience',
            'monitor application stability and functionality',
          ],
        },
        {
          title: '3. AI-generated insights',
          paragraphs: [
            'Some training feedback and recommendations are generated using artificial intelligence services.',
            'These insights are experimental and informational only and must not be considered medical, health, or professional training advice.',
          ],
        },
        {
          title: '4. Third-party services',
          paragraphs: ['VEIRO may use third-party providers including:'],
          bullets: ['Strava API', 'OpenAI API', 'Vercel hosting infrastructure'],
          afterBullets: [
            'These services may process limited technical or activity-related information required for the application to function.',
          ],
        },
        {
          title: '5. Data storage and security',
          paragraphs: [
            'Access tokens and sensitive credentials are stored server-side and are never intentionally exposed client-side.',
            'Reasonable security measures are used to protect stored information.',
          ],
        },
        {
          title: '6. Beta status',
          paragraphs: [
            'VEIRO is currently in a private beta phase.',
            'Features, availability, and stored data may change, be modified, or be removed at any time during development.',
          ],
        },
        {
          title: '7. User rights',
          paragraphs: ['Users may request:'],
          bullets: [
            'access to their stored data',
            'deletion of their account and related information',
            'disconnection of their Strava account',
          ],
        },
        {
          title: '8. Contact',
          paragraphs: ['For any privacy-related request, contact:', 'info@veiro.run'],
        },
      ]}
    />
  );
}
