import { query } from './db';

export interface AthleteSettings {
  id: string;
  profile_summary?: string;
  weight_kg?: number;
  height_cm?: number;
  age?: number;
  main_goal?: string;
  secondary_goal?: string;
  available_days?: string[];
  target_runs_per_week?: number;
  target_weekly_volume_km?: number;
  target_pace?: string;
  target_hr?: string;
  injuries?: string;
  experience_level?: string;
  avoid_overload?: boolean;
  updated_at?: string;
}

/**
 * Recupera le impostazioni dell'atleta
 */
export async function getAthleteSettings(): Promise<AthleteSettings | null> {
  try {
    const result = await query<AthleteSettings>(
      'SELECT * FROM athlete_settings WHERE id = $1',
      ['default']
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('[ATHLETE_SETTINGS] Errore recupero impostazioni:', error);
    throw error;
  }
}

/**
 * Aggiorna le impostazioni dell'atleta
 */
export async function updateAthleteSettings(data: Partial<Omit<AthleteSettings, 'id' | 'updated_at'>>): Promise<void> {
  try {
    const fields = Object.keys(data);
    const values = Object.values(data);

    if (fields.length === 0) {
      throw new Error('Nessun campo da aggiornare');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const queryText = `
      UPDATE athlete_settings
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${fields.length + 1}
    `;

    await query(queryText, [...values, 'default']);
  } catch (error) {
    console.error('[ATHLETE_SETTINGS] Errore aggiornamento impostazioni:', error);
    throw error;
  }
}