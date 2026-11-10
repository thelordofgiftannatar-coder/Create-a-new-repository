import React, { useState } from 'react';
import { Cloud, LogOut, RefreshCw, CheckCircle2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { signInWithGoogleWorkspace, signOutGoogle } from '../services/firebase';
import { triggerHaptic } from '../services/audioEngine';

interface GoogleSignInButtonProps {
  onSuccess?: (user: User, accessToken: string) => void;
  onError?: (err: string) => void;
  label?: string;
  compact?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  label = 'Sign in with Google',
  compact = false,
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    triggerHaptic(15);
    setLoading(true);
    try {
      const result = await signInWithGoogleWorkspace();
      onSuccess?.(result.user, result.accessToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed or was cancelled.';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="gsi-material-button shadow-md"
      style={compact ? { height: '34px', fontSize: '12px', padding: '0 12px' } : undefined}
    >
      <div className="gsi-material-button-state" />
      <div className="gsi-material-button-content-wrapper">
        <div className="gsi-material-button-icon">
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            style={{ display: 'block' }}
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
        </div>
        <span className="gsi-material-button-contents">
          {loading ? 'Connecting...' : label}
        </span>
      </div>
    </button>
  );
};

interface GoogleAccountBannerProps {
  user: User | null;
  accessToken: string | null;
  needsWorkspaceReauth: boolean;
  onSignedIn?: (user: User, token: string) => void;
  onSignedOut?: () => void;
  onError?: (msg: string) => void;
}

export const GoogleAccountBanner: React.FC<GoogleAccountBannerProps> = ({
  user,
  accessToken,
  needsWorkspaceReauth,
  onSignedIn,
  onSignedOut,
  onError,
}) => {
  if (!user) {
    return (
      <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Cloud className="w-4 h-4 text-cyan-400" />
            <span>Sign in to Prime One Cloud</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Sync tracks, ID3 tags, playlists, themes, and access Google Drive & Google Photos across devices.
          </p>
        </div>
        <div className="flex-shrink-0">
          <GoogleSignInButton onSuccess={onSignedIn} onError={onError} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Google User'}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full border border-white/20 object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold flex-shrink-0">
              {(user.displayName || user.email || 'P')[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              <span>{user.displayName || 'Google Account'}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            </div>
            <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            triggerHaptic(15);
            await signOutGoogle();
            onSignedOut?.();
          }}
          className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-400/40 text-slate-300 hover:text-red-300 text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </div>

      {(!accessToken || needsWorkspaceReauth) && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="text-[11px] text-amber-200 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Session restored. Reconnect to unlock Google Drive & Google Photos permissions.</span>
          </div>
          <GoogleSignInButton
            compact
            label="Reconnect Drive & Photos"
            onSuccess={onSignedIn}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
};
