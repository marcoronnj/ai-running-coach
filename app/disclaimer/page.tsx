import type { Metadata } from 'next';
import PolicyPage from '@/app/components/PolicyPage';
import type { PolicyPageProps } from '@/app/components/PolicyPage';
import { getCurrentLanguage } from '@/lib/athlete-settings';
import type { Language } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'VEIRO Beta Disclaimer',
  description: 'Beta disclaimer for VEIRO.',
};

export const dynamic = 'force-dynamic';

const disclaimerContent: Record<Language, Omit<PolicyPageProps, 'dashboardLabel'>> = {
  it: {
    title: 'Disclaimer Beta VEIRO',
    intro: [
      'VEIRO è un running coach sperimentale basato sull’intelligenza artificiale, attualmente disponibile in private beta.',
      'L’applicazione fornisce insight automatici di allenamento e analisi delle attività basati sui dati importati da Strava e su sistemi di intelligenza artificiale.',
    ],
    sections: [
      {
        paragraphs: ['Importante:'],
        bullets: [
          'VEIRO non è un dispositivo medico',
          'VEIRO non fornisce consigli medici',
          'Le raccomandazioni generate dall’AI possono essere inaccurate o incomplete',
          'Gli utenti restano pienamente responsabili delle proprie decisioni di allenamento, della propria salute e dell’attività fisica',
        ],
      },
      {
        paragraphs: ['Utilizzando VEIRO, riconosci che:'],
        bullets: [
          'l’applicazione è ancora in fase di sviluppo',
          'possono verificarsi bug o interruzioni',
          'alcune funzionalità possono cambiare o essere rimosse senza preavviso',
          'gli insight di allenamento sono forniti solo a scopo informativo',
        ],
      },
      {
        paragraphs: [
          'Se avverti dolore, infortuni, problemi di salute o incertezza riguardo all’intensità dell’allenamento, consulta un professionista medico qualificato o un coach prima di prendere decisioni basate sull’applicazione.',
        ],
      },
    ],
  },
  en: {
    title: 'VEIRO Beta Disclaimer',
    intro: [
      'VEIRO is an experimental AI-powered running coach currently available in private beta.',
      'The application provides automated training insights and activity analysis based on imported Strava data and artificial intelligence systems.',
    ],
    sections: [
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
    ],
  },
};

export default async function DisclaimerPage() {
  const language = await getCurrentLanguage();
  const content = disclaimerContent[language];

  return (
    <PolicyPage
      {...content}
      dashboardLabel={language === 'en' ? 'Back to dashboard' : 'Torna alla dashboard'}
    />
  );
}
