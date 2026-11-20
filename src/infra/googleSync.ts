import {
  parseWorkspacePayload,
  serializeWorkspacePayload,
  type WorkspaceSyncPayload,
} from '../domain/workspaceSync';
import type { CalendarEvent, KanbanColumnConfig, NoteItem, Result } from '../domain/types';

export interface GoogleSession {
  readonly accessToken: string;
  readonly email: string;
}

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const DRIVE_BACKUP_FILENAME = 'OND-Workspace-Sync.json';

interface GisTokenResponse {
  readonly access_token?: string;
  readonly error?: string;
  readonly error_description?: string;
}

interface GisWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (resp: GisTokenResponse) => void;
          error_callback?: (err: { message?: string; type?: string }) => void;
        }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
      };
    };
  };
}

let gisLoadPromise: Promise<void> | null = null;

/** Load Google Identity Services strictly on-demand when the user opts into Google Sign-In. */
function ensureGisScriptLoaded(): Promise<void> {
  if ((window as GisWindow).google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('Failed to load Google Sign-In script. Check your internet connection.'));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

export async function signInWithGoogle(clientId: string): Promise<Result<GoogleSession>> {
  const cleanClientId = clientId.trim();
  if (!cleanClientId) {
    return {
      ok: false,
      error: 'Enter your Google Cloud Web OAuth Client ID first.',
    };
  }

  try {
    await ensureGisScriptLoaded();
    const oauth2 = (window as GisWindow).google?.accounts?.oauth2;
    if (!oauth2) {
      return { ok: false, error: 'Google OAuth2 client unavailable.' };
    }

    const token = await new Promise<string>((resolve, reject) => {
      const tokenClient = oauth2.initTokenClient({
        client_id: cleanClientId,
        scope: GOOGLE_SCOPES,
        callback: (resp) => {
          if (resp.error || !resp.access_token) {
            reject(new Error(resp.error_description || resp.error || 'Sign-in cancelled.'));
            return;
          }
          resolve(resp.access_token);
        },
        error_callback: (err) => {
          reject(new Error(err.message || err.type || 'Google Sign-In popup blocked or closed.'));
        },
      });
      tokenClient.requestAccessToken({ prompt: 'consent' });
    });

    let email = 'Google Account';
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profileRes.ok) {
        const profile = (await profileRes.json()) as { email?: string };
        if (profile.email) email = profile.email;
      }
    } catch {
      // Optional display label
    }

    return { ok: true, data: { accessToken: token, email } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Sign-In failed.';
    return { ok: false, error: message };
  }
}

export async function pullGoogleCalendarEvents(
  accessToken: string,
): Promise<Result<CalendarEvent[]>> {
  try {
    const startWindow = new Date();
    startWindow.setMonth(startWindow.getMonth() - 2);
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '200');
    url.searchParams.set('timeMin', startWindow.toISOString());

    const res = await fetch(url.href, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      return { ok: false, error: `Google Calendar pull failed (HTTP ${res.status}).` };
    }

    const data = (await res.json()) as {
      items?: Array<{
        id?: string;
        summary?: string;
        description?: string;
        start?: { date?: string; dateTime?: string };
        end?: { date?: string; dateTime?: string };
        extendedProperties?: { private?: { ondId?: string; ondCategory?: string } };
      }>;
    };

    const events: CalendarEvent[] = [];
    for (const item of data.items ?? []) {
      const title = item.summary?.trim();
      if (!title || !item.start) continue;

      let date = '';
      let startTime: string | null = null;
      let endTime: string | null = null;

      if (item.start.date) {
        date = item.start.date;
      } else if (item.start.dateTime) {
        const match = item.start.dateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
        if (match) {
          date = match[1]!;
          startTime = match[2]!;
        }
        const endMatch = item.end?.dateTime?.match(/T(\d{2}:\d{2})/);
        if (endMatch) endTime = endMatch[1]!;
      }

      if (!date) continue;
      const ondCategory = item.extendedProperties?.private?.ondCategory;
      const category =
        ondCategory === 'meeting' ||
        ondCategory === 'personal' ||
        ondCategory === 'deadline' ||
        ondCategory === 'focus'
          ? ondCategory
          : 'meeting';

      events.push({
        id: item.extendedProperties?.private?.ondId ?? `gcal-${item.id ?? crypto.randomUUID().slice(0, 8)}`,
        title,
        date,
        startTime,
        endTime,
        category,
        notes: item.description?.trim() ?? '',
      });
    }

    return { ok: true, data: events };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error.';
    return { ok: false, error: `Google Calendar pull failed (${message}).` };
  }
}

export async function pushGoogleCalendarEvents(
  accessToken: string,
  events: readonly CalendarEvent[],
): Promise<Result<number>> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let synced = 0;

  try {
    for (const evt of events) {
      const searchUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      searchUrl.searchParams.set('privateExtendedProperty', `ondId=${evt.id}`);
      const existingRes = await fetch(searchUrl.href, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      let existingGcalId: string | null = null;
      if (existingRes.ok) {
        const found = (await existingRes.json()) as { items?: Array<{ id?: string }> };
        existingGcalId = found.items?.[0]?.id ?? null;
      }

      const body = {
        summary: evt.title,
        description: evt.notes,
        start: evt.startTime
          ? { dateTime: `${evt.date}T${evt.startTime}:00`, timeZone }
          : { date: evt.date },
        end: evt.startTime
          ? { dateTime: `${evt.date}T${evt.endTime ?? evt.startTime}:00`, timeZone }
          : { date: evt.date },
        extendedProperties: {
          private: {
            ondId: evt.id,
            ondCategory: evt.category,
          },
        },
      };

      const endpoint = existingGcalId
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingGcalId)}`
        : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

      const writeRes = await fetch(endpoint, {
        method: existingGcalId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (writeRes.ok) synced += 1;
    }

    return { ok: true, data: synced };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error.';
    return { ok: false, error: `Google Calendar push failed (${message}).` };
  }
}

async function findDriveBackupFileId(accessToken: string): Promise<string | null> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `name='${DRIVE_BACKUP_FILENAME}' and trashed=false`);
  url.searchParams.set('fields', 'files(id,name)');
  url.searchParams.set('pageSize', '1');

  const res = await fetch(url.href, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { files?: Array<{ id?: string }> };
  return data.files?.[0]?.id ?? null;
}

export async function saveNotesAndCalendarToGoogleDrive(
  accessToken: string,
  calendarEvents: readonly CalendarEvent[],
  notes: readonly NoteItem[],
  columns: readonly KanbanColumnConfig[],
): Promise<Result<string>> {
  try {
    const jsonContent = serializeWorkspacePayload(calendarEvents, notes, columns);
    const existingId = await findDriveBackupFileId(accessToken);

    if (existingId) {
      const patchRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingId)}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: jsonContent,
        },
      );
      if (!patchRes.ok) {
        return { ok: false, error: `Google Drive update failed (HTTP ${patchRes.status}).` };
      }
      return { ok: true, data: DRIVE_BACKUP_FILENAME };
    }

    const boundary = `ond_sync_${crypto.randomUUID().slice(0, 8)}`;
    const metadata = JSON.stringify({
      name: DRIVE_BACKUP_FILENAME,
      mimeType: 'application/json',
    });
    const multipartBody = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      jsonContent,
      `--${boundary}--`,
    ].join('\r\n');

    const createRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      },
    );

    if (!createRes.ok) {
      return { ok: false, error: `Google Drive save failed (HTTP ${createRes.status}).` };
    }
    return { ok: true, data: DRIVE_BACKUP_FILENAME };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error.';
    return { ok: false, error: `Google Drive sync failed (${message}).` };
  }
}

export async function loadNotesAndCalendarFromGoogleDrive(
  accessToken: string,
): Promise<Result<WorkspaceSyncPayload>> {
  try {
    const fileId = await findDriveBackupFileId(accessToken);
    if (!fileId) {
      return {
        ok: false,
        error: `No "${DRIVE_BACKUP_FILENAME}" backup found in Google Drive yet. Save to Drive first.`,
      };
    }

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok) {
      return { ok: false, error: `Google Drive download failed (HTTP ${res.status}).` };
    }

    const rawText = await res.text();
    return parseWorkspacePayload(rawText);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error.';
    return { ok: false, error: `Google Drive restore failed (${message}).` };
  }
}
