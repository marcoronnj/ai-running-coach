import type { Metadata } from 'next';
import PolicyPage from '@/app/components/PolicyPage';

export const metadata: Metadata = {
  title: 'VEIRO Beta Disclaimer',
  description: 'Beta disclaimer for VEIRO.',
};

export default function DisclaimerPage() {
  return (
    <PolicyPage
      title="VEIRO Beta Disclaimer"
      intro={[
        'VEIRO is an experimental AI-powered running coach currently available in private beta.',
        'The application provides automated training insights and activity analysis based on imported Strava data and artificial intelligence systems.',
      ]}
      sections={[
        {
          paragraphs: ['Important:'],
          bullets: [
            'VEIRO is not a medical device',
            'VEIRO does not provide medical advice',
            'AI-generated recommendations may be inaccurate or incomplete',
            'Users remain fully responsible for their own training decisions, health, and physical activity',
          ],
        },
        {
          paragraphs: ['By using VEIRO, you acknowledge that:'],
          bullets: [
            'the application is still under development',
            'bugs or interruptions may occur',
            'some features may change or be removed without notice',
            'training insights are provided for informational purposes only',
          ],
        },
        {
          paragraphs: [
            'If you experience pain, injury, health issues, or uncertainty regarding training intensity, consult a qualified medical professional or coach before making decisions based on the application.',
          ],
        },
      ]}
    />
  );
}
