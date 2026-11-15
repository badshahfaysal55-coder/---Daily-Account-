import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Provider with required Drive scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory access token cache per integration guidelines
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;
let isSigningIn = false;

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

export interface GoogleDriveBackupStatus {
  isConnected: boolean;
  userEmail: string | null;
  userName: string | null;
  userPhoto: string | null;
  lastBackupAt: number | null;
  lastBackupFileId: string | null;
  autoSyncEnabled: boolean;
  statusMessage: string | null;
}

class GoogleDriveService {
  private listeners: Array<(status: GoogleDriveBackupStatus) => void> = [];
  private autoSyncTimer: any = null;

  constructor() {
    this.initAuthListener();
  }

  private initAuthListener() {
    onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        cachedGoogleUser = user;
        this.emitStatus();
      } else {
        cachedGoogleUser = null;
        cachedAccessToken = null;
        this.emitStatus();
      }
    });
  }

  public subscribe(cb: (status: GoogleDriveBackupStatus) => void) {
    this.listeners.push(cb);
    cb(this.getStatus());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  public getStatus(): GoogleDriveBackupStatus {
    const lastBackupAtStr = localStorage.getItem('zara_drive_last_backup_at');
    const lastBackupFileId = localStorage.getItem('zara_drive_last_file_id');
    const autoSync = localStorage.getItem('zara_drive_auto_sync') !== 'false';

    return {
      isConnected: Boolean(cachedAccessToken && cachedGoogleUser),
      userEmail: cachedGoogleUser?.email || null,
      userName: cachedGoogleUser?.displayName || null,
      userPhoto: cachedGoogleUser?.photoURL || null,
      lastBackupAt: lastBackupAtStr ? parseInt(lastBackupAtStr, 10) : null,
      lastBackupFileId: lastBackupFileId || null,
      autoSyncEnabled: autoSync,
      statusMessage: cachedAccessToken ? 'Connected to Google Drive' : 'Ready to connect',
    };
  }

  private emitStatus() {
    const status = this.getStatus();
    this.listeners.forEach((l) => l(status));
  }

  public async connectGoogleDrive(): Promise<{ user: User; accessToken: string }> {
    try {
      isSigningIn = true;
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to retrieve Google Drive OAuth token from authorization');
      }

      cachedAccessToken = credential.accessToken;
      cachedGoogleUser = result.user;
      this.emitStatus();
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (err: any) {
      console.error('Google Drive sign-in error:', err);
      throw err;
    } finally {
      isSigningIn = false;
    }
  }

  public async disconnectGoogleDrive(): Promise<void> {
    try {
      await signOut(auth);
      cachedAccessToken = null;
      cachedGoogleUser = null;
      this.emitStatus();
    } catch (err) {
      console.error('Google Drive sign out error:', err);
    }
  }

  public async getAccessToken(): Promise<string | null> {
    return cachedAccessToken;
  }

  public setAutoSync(enabled: boolean) {
    localStorage.setItem('zara_drive_auto_sync', enabled ? 'true' : 'false');
    this.emitStatus();
  }

  /**
   * Search for an existing backup file by name on the user's Google Drive
   */
  public async findFileByName(fileName: string): Promise<DriveFileInfo | null> {
    if (!cachedAccessToken) return null;

    try {
      const q = encodeURIComponent(`name = '${fileName}' and trashed = false`);
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)&pageSize=1`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${cachedAccessToken}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          cachedAccessToken = null;
          this.emitStatus();
        }
        return null;
      }

      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0];
      }
      return null;
    } catch (e) {
      console.error('Failed to search Drive file:', e);
      return null;
    }
  }

  /**
   * Upload or update complete application backup in Google Drive
   */
  public async backupAppDataToDrive(appData: {
    invoices?: any[];
    homeBazarEntries?: any[];
    commissionEntries?: any[];
    transactions?: any[];
    customers?: any[];
    globalSettings?: any;
    monthlyBudget?: number;
    bazarBuyers?: any[];
  }): Promise<{ fileId: string; webViewLink?: string }> {
    if (!cachedAccessToken) {
      throw new Error('Google Drive is not connected. Please connect your Google account first.');
    }

    const fileName = 'ZARA_Enterprise_Cloud_Accounting_Backup.json';
    const existingFile = await this.findFileByName(fileName);

    const payload = {
      exportedAt: new Date().toISOString(),
      timestamp: Date.now(),
      appName: 'ZARA Accounting & Holding Systems',
      user: cachedGoogleUser?.email,
      data: appData,
    };

    const jsonContent = JSON.stringify(payload, null, 2);

    if (existingFile) {
      // Update existing file content
      const patchUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
      const updateRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${cachedAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: jsonContent,
      });

      if (!updateRes.ok) {
        throw new Error(`Failed to update Drive backup: ${updateRes.statusText}`);
      }

      const updated = await updateRes.json();
      localStorage.setItem('zara_drive_last_backup_at', String(Date.now()));
      localStorage.setItem('zara_drive_last_file_id', existingFile.id);
      this.emitStatus();

      return { fileId: existingFile.id, webViewLink: existingFile.webViewLink };
    } else {
      // Create new file with metadata & content via multipart upload
      const metadata = {
        name: fileName,
        mimeType: 'application/json',
        description: 'Automated Real-Time Cloud Backup for ZARA Accounting App',
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        jsonContent +
        closeDelim;

      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
      const createRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cachedAccessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

      if (!createRes.ok) {
        throw new Error(`Failed to create Drive backup: ${createRes.statusText}`);
      }

      const created = await createRes.json();
      localStorage.setItem('zara_drive_last_backup_at', String(Date.now()));
      localStorage.setItem('zara_drive_last_file_id', created.id);
      this.emitStatus();

      return { fileId: created.id, webViewLink: created.webViewLink };
    }
  }

  /**
   * Upload Commission Statement directly to Google Drive as an independent file
   */
  public async syncCommissionStatementToDrive(
    commissionEntries: any[],
    statementSummary: any
  ): Promise<{ fileId: string; webViewLink?: string }> {
    if (!cachedAccessToken) {
      throw new Error('Google Drive is not connected');
    }

    const fileName = 'ZARA_Commission_Statement.json';
    const existingFile = await this.findFileByName(fileName);

    const payload = {
      title: 'ZARA Commission Statement',
      syncedAt: new Date().toISOString(),
      summary: statementSummary,
      entries: commissionEntries,
    };

    const jsonContent = JSON.stringify(payload, null, 2);

    if (existingFile) {
      const patchUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${cachedAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: jsonContent,
      });
      if (!res.ok) throw new Error('Failed to update Commission Statement on Drive');
      return { fileId: existingFile.id, webViewLink: existingFile.webViewLink };
    } else {
      const metadata = {
        name: fileName,
        mimeType: 'application/json',
        description: 'Auto-synced ZARA Commission Statement & Agent Payout Records',
      };
      const boundary = '-------comm789123456';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        jsonContent +
        closeDelim;

      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cachedAccessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });
      if (!res.ok) throw new Error('Failed to upload Commission Statement to Drive');
      const created = await res.json();
      return { fileId: created.id, webViewLink: created.webViewLink };
    }
  }

  /**
   * Schedule debounced auto-sync when data changes
   */
  public triggerDebouncedAutoSync(getAppData: () => Promise<any>) {
    const status = this.getStatus();
    if (!status.isConnected || !status.autoSyncEnabled) return;

    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer);
    }

    this.autoSyncTimer = setTimeout(async () => {
      try {
        const data = await getAppData();
        await this.backupAppDataToDrive(data);
      } catch (err) {
        console.warn('Background Google Drive auto-sync notice:', err);
      }
    }, 4000); // 4-second debounce
  }
}

export const googleDriveService = new GoogleDriveService();
