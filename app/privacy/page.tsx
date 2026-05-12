import type { Metadata } from 'next';
import PolicyPage from '@/app/components/PolicyPage';
import type { PolicyPageProps } from '@/app/components/PolicyPage';
import { getCurrentLanguage } from '@/lib/athlete-settings';
import type { Language } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Privacy Policy – VEIRO',
  description: 'Privacy Policy for VEIRO.',
};

export const dynamic = 'force-dynamic';

const privacyContent: Record<Language, Omit<PolicyPageProps, 'dashboardLabel'>> = {
  it: {
    title: 'Privacy Policy – VEIRO',
    updated: 'Ultimo aggiornamento: Maggio 2026',
    intro: [
      'VEIRO è un’applicazione in private beta focalizzata sull’analisi della corsa e su insight di allenamento basati sull’intelligenza artificiale.',
      'Utilizzando VEIRO, riconosci e accetti la raccolta e il trattamento di determinati dati personali e relativi all’attività, come descritto di seguito.',
    ],
    sections: [
      {
        title: '1. Dati raccolti',
        paragraphs: ['Durante l’utilizzo di VEIRO, l’applicazione può raccogliere e trattare:'],
        bullets: [
          'Informazioni dell’account Strava autorizzate tramite OAuth',
          {
            text: 'Dati delle attività di corsa da Strava, inclusi:',
            children: [
              'distanza',
              'durata',
              'passo',
              'frequenza cardiaca',
              'dislivello',
              'data e titolo dell’attività',
            ],
          },
          'Informazioni del profilo utente fornite volontariamente',
          'Informazioni tecniche e diagnostiche necessarie per far funzionare il servizio',
        ],
        afterBullets: ['VEIRO accede solo ai dati esplicitamente autorizzati dall’utente tramite Strava.'],
      },
      {
        title: '2. Come vengono usati i dati',
        paragraphs: ['I dati raccolti vengono utilizzati esclusivamente per:'],
        bullets: [
          'sincronizzare le attività di corsa',
          'generare insight e riepiloghi di allenamento basati sull’intelligenza artificiale',
          'migliorare l’esperienza del running coach',
          'monitorare stabilità e funzionalità dell’applicazione',
        ],
        afterBullets: [
          'I dati delle attività dell’utente vengono utilizzati esclusivamente per generare insight personalizzati per il singolo atleta e non vengono utilizzati per addestrare modelli di intelligenza artificiale general-purpose.',
        ],
      },
      {
        title: '3. Insight generati dall’AI',
        paragraphs: [
          'Alcuni feedback e raccomandazioni di allenamento sono generati utilizzando servizi di intelligenza artificiale.',
          'Questi insight sono sperimentali e solo informativi e non devono essere considerati consigli medici, sanitari o professionali di allenamento.',
        ],
      },
      {
        title: '4. Servizi di terze parti',
        paragraphs: ['VEIRO può utilizzare provider di terze parti tra cui:'],
        bullets: ['Strava API', 'OpenAI API', 'Infrastruttura di hosting Vercel'],
        afterBullets: [
          'Questi servizi possono trattare informazioni tecniche o relative all’attività in misura limitata, necessarie al funzionamento dell’applicazione.',
        ],
      },
      {
        title: '5. Archiviazione e sicurezza dei dati',
        paragraphs: [
          'I token di accesso e le credenziali sensibili sono archiviati lato server e non vengono intenzionalmente esposti lato client.',
          'Vengono utilizzate misure di sicurezza ragionevoli per proteggere le informazioni archiviate.',
        ],
      },
      {
        title: '6. Stato beta',
        paragraphs: [
          'VEIRO è attualmente in una fase di private beta.',
          'Funzionalità, disponibilità e dati archiviati possono cambiare, essere modificati o rimossi in qualsiasi momento durante lo sviluppo.',
        ],
      },
      {
        title: '7. Diritti dell’utente',
        paragraphs: ['Gli utenti possono richiedere:'],
        bullets: [
          'accesso ai propri dati archiviati',
          'eliminazione del proprio account e delle informazioni correlate',
          'disconnessione del proprio account Strava',
        ],
      },
      {
        title: '8. Contatti',
        paragraphs: ['Per qualsiasi richiesta relativa alla privacy, contattare:', 'info@veiro.run'],
      },
    ],
  },
  en: {
    title: 'Privacy Policy – VEIRO',
    updated: 'Last updated: May 2026',
    intro: [
      'VEIRO is a private beta application focused on running analysis and AI-powered training insights.',
      'By using VEIRO, you acknowledge and accept the collection and processing of certain personal and activity-related data as described below.',
    ],
    sections: [
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
        afterBullets: [
          'User activity data is used exclusively to generate personalized insights for the individual athlete and is not used to train general-purpose AI models.',
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
    ],
  },
};

export default async function PrivacyPage() {
  const language = await getCurrentLanguage();
  const content = privacyContent[language];

  return (
    <PolicyPage
      {...content}
      dashboardLabel={language === 'en' ? 'Back to dashboard' : 'Torna alla dashboard'}
    />
  );
}
