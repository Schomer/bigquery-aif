'use client';

// /shared — Read-only view of a shared result card.
// Reads the share ID from the URL hash: /shared#share_abc123
// This avoids dynamic segments which are incompatible with static export.
//
// ShareLinkButton should use: `${origin}/shared#${id}`

import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

interface SharedArtifact {
  id: string;
  skill: string;
  headline: string;
  primaryArtifactType: string;
  sql?: string | null;
  createdAt: string;
  expiresAt?: string;
}

async function fetchSharedArtifact(id: string): Promise<SharedArtifact | null> {
  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('@/lib/firebase');
  const snap = await getDoc(doc(db, 'sharedArtifacts', id));
  if (!snap.exists()) return null;
  return snap.data() as SharedArtifact;
}

export default function SharedPage() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [shareId, setShareId] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<SharedArtifact | null | 'not-found'>(null);
  const [loading, setLoading] = useState(true);

  // Read ID from URL hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '').trim();
    setShareId(hash || null);
  }, []);

  // Auth
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, user => setUid(user?.uid ?? null));
  }, []);

  // Fetch artifact
  useEffect(() => {
    if (uid === undefined || !shareId) return;
    if (uid === null) { setLoading(false); return; }
    setLoading(true);
    fetchSharedArtifact(shareId)
      .then(a => setArtifact(a ?? 'not-found'))
      .catch(() => setArtifact('not-found'))
      .finally(() => setLoading(false));
  }, [uid, shareId]);

  const isExpired = artifact && artifact !== 'not-found' && artifact.expiresAt
    ? new Date(artifact.expiresAt) < new Date()
    : false;

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: "'Google Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ height: 52, borderBottom: '1px solid #e0e0e0', background: '#fff', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12 }}>
        <img src="/crystal-ball.svg" width={22} height={22} alt="" />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#202124' }}>BigQuery AIF</span>
        <div style={{ flex: 1 }} />
        <a href="/" style={{ fontSize: 13, color: '#1967d2', textDecoration: 'none', fontWeight: 500 }}>Open app</a>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 760 }}>

          {!shareId ? (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#202124', marginBottom: 8 }}>No share ID in URL</div>
              <div style={{ fontSize: 14, color: '#5f6368' }}>Use a valid shared link to view a result.</div>
            </div>
          ) : uid === undefined || loading ? (
            <div style={{ fontSize: 14, color: '#5f6368', textAlign: 'center', padding: 40 }}>Loading...</div>
          ) : uid === null ? (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#202124' }}>Sign in required</div>
              <div style={{ fontSize: 14, color: '#5f6368', marginBottom: 20 }}>This shared result is only visible to signed-in users.</div>
              <a href="/" style={{ display: 'inline-block', padding: '10px 24px', background: '#1967d2', color: 'white', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Sign in to view</a>
            </div>
          ) : artifact === 'not-found' ? (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#202124' }}>Result not found</div>
              <div style={{ fontSize: 14, color: '#5f6368' }}>This link may have expired or been deleted.</div>
            </div>
          ) : isExpired ? (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#202124' }}>Link expired</div>
              <div style={{ fontSize: 14, color: '#5f6368' }}>Shared links are valid for 7 days.</div>
            </div>
          ) : artifact ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                {artifact.skill.replace(/-/g, ' ')}
              </div>
              <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#202124', lineHeight: 1.35, marginBottom: artifact.sql ? 20 : 0 }}>
                  {artifact.headline}
                </div>
                {artifact.sql && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>SQL</div>
                    <pre style={{ background: '#f3f4f6', borderRadius: 8, padding: '14px 16px', fontSize: 12, color: '#202124', overflow: 'auto', margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, monospace', lineHeight: 1.5 }}>
                      {artifact.sql}
                    </pre>
                  </>
                )}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#9aa0a6' }}>
                    Shared {new Date(artifact.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <a href="/" style={{ fontSize: 12, color: '#1967d2', textDecoration: 'none', fontWeight: 500 }}>
                    Open in app &rarr;
                  </a>
                </div>
              </div>
              {artifact.expiresAt && (
                <div style={{ fontSize: 11, color: '#9aa0a6', textAlign: 'center', marginTop: 12 }}>
                  Expires {new Date(artifact.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </>
          ) : null}

        </div>
      </div>
    </div>
  );
}
