'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getFavoriteProjects, saveFavoriteProjects } from '@/lib/firestore-service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  MaterialSymbols,
  snackbar,
  cn,
} from '@/kit';

interface ProjectPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FAVORITES_KEY = 'hdn_favorite_projects';

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites(favs: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
  } catch {
    /* ignore */
  }
}

export function ProjectPickerDialog({ open, onOpenChange }: ProjectPickerDialogProps) {
  const { user, accessToken, projects, activeProject, setActiveProject } = useAuth();
  const [search, setSearch] = useState('');
  const [liveResults, setLiveResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFavorites(loadFavorites());
    if (user?.uid) {
      getFavoriteProjects(user.uid)
        .then((ids) => {
          if (ids.length > 0) {
            const merged = new Set([...ids, ...loadFavorites()]);
            setFavorites(merged);
            saveFavorites(merged);
          }
        })
        .catch(() => {});
    }
  }, [user?.uid]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch('');
      setLiveResults([]);
    }
  }, [open]);

  // Live search: CRM v3 full-text + CRM v1 prefix + direct BQ probe
  useEffect(() => {
    const q = search.trim();
    if (!q || !accessToken) {
      setLiveResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const found = new Set<string>();

      await Promise.allSettled([
        // 1. CRM v3 search
        (async () => {
          const url = new URL('https://cloudresourcemanager.googleapis.com/v3/projects:search');
          url.searchParams.set('query', q);
          url.searchParams.set('pageSize', '50');
          const res = await fetch(url.toString(), { headers });
          if (!res.ok) return;
          const data = await res.json();
          for (const p of data.projects ?? []) {
            const id: string = p.projectId ?? p.name?.split('/').pop() ?? '';
            if (id) found.add(id);
          }
        })(),
        // 2. CRM v1 prefix
        (async () => {
          const url = new URL('https://cloudresourcemanager.googleapis.com/v1/projects');
          url.searchParams.set('filter', `id:${q}* lifecycleState:ACTIVE`);
          url.searchParams.set('pageSize', '50');
          const res = await fetch(url.toString(), { headers });
          if (!res.ok) return;
          const data = await res.json();
          for (const p of data.projects ?? []) {
            if (p.projectId) found.add(p.projectId);
          }
        })(),
        // 3. Direct BQ probe
        (async () => {
          if (/\s/.test(q)) return;
          const probeId = q.toLowerCase();
          const res = await fetch(
            `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(probeId)}/datasets?maxResults=1`,
            { headers }
          );
          if (res.status === 200 || res.status === 403) {
            found.add(probeId);
          }
        })(),
      ]);

      setLiveResults([...found]);
      setIsSearching(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [search, accessToken]);

  const toggleFavorite = useCallback(
    (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(projectId)) next.delete(projectId);
        else next.add(projectId);
        saveFavorites(next);
        if (user?.uid) {
          saveFavoriteProjects(user.uid, [...next]).catch(() => {});
        }
        return next;
      });
    },
    [user?.uid]
  );

  const DEFAULT_VISIBLE = 25;

  const { favoritedProjects, otherProjects } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const favoritedProjects = [...favorites];
    const nonFavs = projects.filter((p) => !favorites.has(p));

    if (q) {
      const localFavMatches = favoritedProjects.filter((p) => p.toLowerCase().includes(q));
      const localOtherMatches = nonFavs.filter((p) => p.toLowerCase().includes(q));
      const seen = new Set<string>([...localFavMatches, ...localOtherMatches]);
      const liveExtra: string[] = [];
      for (const p of liveResults) {
        if (!seen.has(p)) {
          seen.add(p);
          if (favorites.has(p)) localFavMatches.push(p);
          else liveExtra.push(p);
        }
      }
      return { favoritedProjects: localFavMatches, otherProjects: [...localOtherMatches, ...liveExtra] };
    }

    return {
      favoritedProjects,
      otherProjects: nonFavs.slice(0, DEFAULT_VISIBLE),
    };
  }, [projects, favorites, search, liveResults]);

  const handleSelect = (p: string) => {
    setActiveProject(p);
    onOpenChange(false);
    snackbar(`Switched active project to ${p}`);
  };

  const renderProjectRow = (p: string) => {
    const isSelected = p === activeProject;
    const isFav = favorites.has(p);

    return (
      <div
        key={p}
        onClick={() => handleSelect(p)}
        className={cn(
          'flex items-center justify-between px-3 py-2 rounded-xl text-cm-body-medium cursor-pointer transition-colors group',
          isSelected ? 'bg-cm-backdrop-active text-cm-on-backdrop' : 'hover:bg-cm-surface-variant text-cm-on-surface'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <MaterialSymbols.CloudQueue
            className={cn('size-4 shrink-0', isSelected ? 'text-cm-primary' : 'text-cm-on-surface-variant')}
          />
          <span className="truncate font-medium">{p}</span>
          {isSelected && <MaterialSymbols.Check className="size-4 text-cm-primary shrink-0" />}
        </div>
        <button
          type="button"
          onClick={(e) => toggleFavorite(e, p)}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          className={cn(
            'size-7 rounded-full flex items-center justify-center transition-opacity cursor-pointer',
            isFav
              ? 'text-amber-500 hover:bg-amber-500/10'
              : 'text-cm-on-surface-variant-low opacity-0 group-hover:opacity-100 hover:text-cm-on-surface hover:bg-cm-container'
          )}
        >
          {isFav ? <MaterialSymbols.Star className="size-4" /> : <MaterialSymbols.StarBorder className="size-4" />}
        </button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6">
        <DialogHeader>
          <DialogTitle>Select Google Cloud Project</DialogTitle>
          <DialogDescription>
            Choose or search for a BigQuery project to explore datasets and execute queries.
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative w-full my-2">
          <Input
            ref={searchInputRef}
            placeholder="Search projects by ID or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<MaterialSymbols.Search className="size-4 text-cm-on-surface-variant" />}
            clearable
          />
          {isSearching && (
            <div className="absolute right-9 top-1/2 -translate-y-1/2">
              <MaterialSymbols.ProgressActivity className="size-4 animate-spin text-cm-primary" />
            </div>
          )}
        </div>

        {/* List of projects */}
        <div className="max-h-[340px] overflow-y-auto flex flex-col gap-1 pr-1">
          {/* Starred Projects */}
          {favoritedProjects.length > 0 && (
            <div className="mb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-cm-on-surface-variant-low px-3 py-1 flex items-center gap-1.5">
                <MaterialSymbols.Star className="size-3 text-amber-500" />
                <span>Starred Projects</span>
              </div>
              <div className="flex flex-col gap-0.5">{favoritedProjects.map(renderProjectRow)}</div>
            </div>
          )}

          {/* All / Other Projects */}
          {otherProjects.length > 0 && (
            <div>
              {favoritedProjects.length > 0 && (
                <div className="text-[11px] font-semibold uppercase tracking-wider text-cm-on-surface-variant-low px-3 py-1">
                  All Projects
                </div>
              )}
              <div className="flex flex-col gap-0.5">{otherProjects.map(renderProjectRow)}</div>
            </div>
          )}

          {favoritedProjects.length === 0 && otherProjects.length === 0 && (
            <div className="py-8 text-center text-cm-body-medium text-cm-on-surface-variant-low">
              {search ? `No projects matching "${search}"` : 'No projects accessible'}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
